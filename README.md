# FlaskChat

FlaskChat is a real-time chat application built with Flask, Flask-SocketIO, and Redis. It supports local authentication, real-time messaging (including text and sticker messages), message deletion, and responsive design. The app features a modern chat interface with date dividers, private and group messaging, and an emoji/sticker picker.

## Features

- **Local Authentication**  
  - User registration and login using Flask-Login.
  - Secure password storage with Werkzeug’s password hashing.

- **Real-Time Chat**  
  - Real-time messaging powered by Flask-SocketIO.
  - Supports both text and sticker (emoji) messages.
  - Date dividers inserted between messages when a new day begins.
  - Private chat functionality using room-based messaging.

- **Message Management**  
  - Delete messages: Users can delete their own messages, which are removed from both the chat window and the database (Redis).
  - Message persistence: Messages are stored in Redis (with persistence configured via RDB or AOF).

- **User Interface**  
  - Responsive design with distinct layouts for different devices.
  - Emoji picker for quick sticker/emoji access.
  - Modern CSS styling with a dark/light theme option.
  - Sidebar with user profile information and status indicators.

## Tech Stack

- **Backend:**  
  - [Python 3](https://www.python.org/)
  - [Flask](https://flask.palletsprojects.com/)  
  - [Flask-SocketIO](https://flask-socketio.readthedocs.io/) for real-time messaging
  - [Flask-Login](https://flask-login.readthedocs.io/) for user authentication
  - [Redis](https://redis.io/) for message storage and persistence

- **Frontend:**  
  - HTML5 and CSS3 for markup and styling  
  - JavaScript for dynamic chat functionalities
  - [Socket.IO Client](https://socket.io/) for client-server communication
  - Emoji/sticker picker (using a simple custom implementation or third-party libraries)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/FlaskChat.git
   cd FlaskChat
   ```

2. **Create and activate a virtual environment:**

   ```bash
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # or
   source venv/bin/activate  # On macOS/Linux
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**  
   Create a `.env` file or set environment variables directly in your system. At a minimum, set:

   - `SECRET_KEY` – Your secret key for Flask sessions.
   - `REDIS_URL` – The connection URL for your Redis instance (e.g., `redis://localhost:6379`).

5. **Run Redis:**  
   Ensure you have a Redis instance running. You can run Redis locally or use a hosted Redis service.

6. **Start the application:**

   ```bash
   flask run
   # or, if using socketio:
   python app.py
   ```

## Folder Structure

```
FlaskChat/
├── app.py                 # Main Flask application with SocketIO events
├── requirements.txt       # List of Python dependencies
├── static/
│   ├── css/
│   │   ├── style.css      # Global styles for the app
│   │   └── chat.css       # Chat-specific styles
│   └── js/
│       └── chat.js        # Client-side chat functionality
├── templates/
│   ├── chat.html         # Chat interface template
│   ├── login.html        # Login page template
│   ├── register.html     # Registration page template
│   ├── profile.html      # User profile page template
│   └── edit_profile.html # Profile edit page template
└── README.md              # This file
```

## Usage

- **User Registration & Login:**  
  Users can register and log in locally. The authentication system uses Flask-Login and stores user data in Redis.

- **Chat Interface:**  
  Once logged in, users can access the chat interface to send real-time messages. The interface displays messages along with sender avatars, timestamps, and supports deletion by the message sender.

- **Emoji/Sticker Support:**  
  Click the sticker button to open the emoji picker. Selected emojis are sent as sticker messages and rendered with enhanced styling in the chat.

- **Message Deletion:**  
  Each message sent by the current user shows a delete button. On confirmation, the message is removed from Redis and the chat is updated in real time for all participants.

## Credits

- Developed using [Flask](https://flask.palletsprojects.com/) and [Flask-SocketIO](https://flask-socketio.readthedocs.io/).
- Real-time functionality powered by Socket.IO.
- Emoji picker and chat UI designed with HTML, CSS, and JavaScript.


