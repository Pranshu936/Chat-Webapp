import os
import json
import uuid
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import redis

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'secret key')
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_client = redis.from_url(redis_url)

socketio = SocketIO(app, message_queue=redis_url, cors_allowed_origins="*")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User model for Flask-Login (Local Authentication)
class User(UserMixin):
    def __init__(self, id, username, email, avatar=None):
        self.id = id
        self.username = username
        self.email = email
        self.avatar = avatar or f"https://ui-avatars.com/api/?name={username}&background=random"
        self.online = True

@login_manager.user_loader
def load_user(user_id):
    user_data = redis_client.hgetall(f"user:{user_id}")
    if not user_data:
        return None
    user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
    return User(
        id=user_id,
        username=user_data.get('username'),
        email=user_data.get('email'),
        avatar=user_data.get('avatar')
    )

# Local Login Route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user_id = redis_client.get(f"username:{username}")
        if not user_id:
            flash("Invalid username or password.", "error")
            return redirect(url_for('login'))
        user_id = user_id.decode('utf-8')
        user_data = redis_client.hgetall(f"user:{user_id}")
        if not user_data:
            flash("Invalid username or password.", "error")
            return redirect(url_for('login'))
        user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
        if not check_password_hash(user_data.get("password", ""), password):
            flash("Invalid username or password.", "error")
            return redirect(url_for('login'))
        user = User(
            id=user_id,
            username=user_data.get('username'),
            email=user_data.get('email'),
            avatar=user_data.get('avatar')
        )
        login_user(user)
        redis_client.hset(f"user:{user_id}", 'online', 'true')
        flash("Logged in successfully.", "success")
        return redirect(url_for('chat'))
    return render_template('login.html')

# Local Logout Route
@app.route('/logout')
@login_required
def logout():
    redis_client.hset(f"user:{current_user.id}", 'online', 'false')
    socketio.emit('user_status', {
        'user_id': current_user.id,
        'username': current_user.username,
        'status': 'offline'
    }, skip_sid=request.sid)
    logout_user()
    return redirect(url_for('login'))

# Registration Route
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        if redis_client.exists(f"username:{username}") or redis_client.exists(f"email:{email}"):
            flash("User already exists.", "error")
            return redirect(url_for('register'))
        user_id = str(uuid.uuid4())
        redis_client.hmset(f"user:{user_id}", {
            'username': username,
            'email': email,
            'password': generate_password_hash(password),
            'avatar': f"https://ui-avatars.com/api/?name={username}&background=random",
            'online': 'false',
            'nickname': username,  # Default nickname
            'bio': ''
        })
        redis_client.set(f"username:{username}", user_id)
        redis_client.set(f"email:{email}", user_id)
        flash("Registration successful. Please log in.", "success")
        return redirect(url_for('login'))
    return render_template("register.html")

@app.route('/')
def index():
    return redirect(url_for('chat') if current_user.is_authenticated else url_for('login'))

# Chat Route
@app.route('/chat')
@login_required
def chat():
    users = []
    for key in redis_client.keys('user:*'):
        key_str = key.decode('utf-8')
        if key_str.count(':') != 1:
            continue
        user_id = key_str.split(':')[1]
        user_data = redis_client.hgetall(key)
        if user_data:
            user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
            users.append({
                'id': user_id,
                'username': user_data.get('username'),
                'avatar': user_data.get('avatar'),
                'online': user_data.get('online', 'false') == 'true'
            })
    return render_template('chat.html', users=users)

# API Endpoints
@app.route('/api/messages')
@login_required
def get_messages():
    room = request.args.get('room', 'general')
    messages_data = redis_client.lrange(f"room:{room}:messages", 0, 49)
    messages = []
    for msg_data in messages_data:
        try:
            msg = json.loads(msg_data)
            messages.append(msg)
        except Exception:
            continue
    return jsonify({'messages': messages[::-1]})

@app.route('/api/user/<user_id>')
@login_required
def get_user(user_id):
    user_data = redis_client.hgetall(f"user:{user_id}")
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
    user_data.pop('password', None)
    return jsonify(user_data)

@app.route('/api/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    file_url = url_for('static', filename=f'uploads/{filename}')
    return jsonify({'url': file_url})

# Profile Routes
@app.route('/profile/<user_id>')
@login_required
def profile(user_id):
    user_data = redis_client.hgetall(f"user:{user_id}")
    if not user_data:
        flash("User not found", "error")
        return redirect(url_for("chat"))
    user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
    user_data["id"] = user_id
    return render_template("profile.html", user=user_data)

@app.route('/edit_profile', methods=['GET', 'POST'])
@login_required
def edit_profile():
    user_key = f"user:{current_user.id}"
    if request.method == "POST":
        nickname = request.form.get("nickname", current_user.username)
        bio = request.form.get("bio", "")
        redis_client.hset(user_key, "nickname", nickname)
        redis_client.hset(user_key, "bio", bio)
        flash("Profile updated successfully", "success")
        return redirect(url_for("profile", user_id=current_user.id))
    user_data = redis_client.hgetall(user_key)
    user_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in user_data.items()}
    user_data["id"] = current_user.id
    return render_template("edit_profile.html", user=user_data)

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        join_room('general')
        connections = redis_client.incr(f"user:{current_user.id}:connections")
        if connections == 1:
            redis_client.hset(f"user:{current_user.id}", 'online', 'true')
            emit('user_status', {
                'user_id': current_user.id,
                'username': current_user.username,
                'status': 'online'
            }, skip_sid=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        connections = redis_client.decr(f"user:{current_user.id}:connections")
        if connections <= 0:
            redis_client.hset(f"user:{current_user.id}", 'online', 'false')
            emit('user_status', {
                'user_id': current_user.id,
                'username': current_user.username,
                'status': 'offline'
            }, skip_sid=request.sid)

@socketio.on('join')
def handle_join(data):
    join_room(data.get('room', 'general'))

@socketio.on('leave')
def handle_leave(data):
    leave_room(data.get('room', 'general'))

@socketio.on('message')
def handle_message(data):
    room = data.get('room', 'general')
    message = {
        'id': str(uuid.uuid4()),
        'user_id': current_user.id,
        'username': current_user.username,
        'avatar': current_user.avatar,
        'content': data.get('content') or data.get('message', ''),
        'timestamp': datetime.now().isoformat(),
        'type': data.get('type', 'text'),
        'file_url': data.get('file_url')
    }
    redis_client.lpush(f"room:{room}:messages", json.dumps(message))
    redis_client.ltrim(f"room:{room}:messages", 0, 199)
    emit('message', message, room=room)

@socketio.on('typing')
def handle_typing(data):
    emit('typing', {
        'user_id': current_user.id,
        'username': current_user.username,
        'isTyping': data.get('isTyping', False)
    }, room=data.get('room', 'general'), include_self=False)

@socketio.on('delete_message')
def handle_delete_message(data):
    room = data.get('room', 'general')
    message_id = data.get('message_id')
    messages_data = redis_client.lrange(f"room:{room}:messages", 0, -1)
    for msg_data in messages_data:
        try:
            msg = json.loads(msg_data)
            if msg.get('id') == message_id and msg.get('user_id') == current_user.id:
                redis_client.lrem(f"room:{room}:messages", 1, msg_data)
                emit('message_deleted', {'message_id': message_id}, room=room)
                break
        except Exception:
            continue

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 8000)), debug=True)
