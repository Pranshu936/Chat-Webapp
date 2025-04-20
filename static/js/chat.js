document.addEventListener("DOMContentLoaded", () => {
    // Initialize Socket.IO
    const socket = io()
  
    // DOM Elements
    const messagesContainer = document.getElementById("messages")
    const messageInput = document.getElementById("message-input")
    const sendButton = document.getElementById("send-button")
    const fileInput = document.getElementById("file-input")
    const attachmentButton = document.getElementById("attachment-button")
    const emojiButton = document.getElementById("emoji-button")
    const emojiPickerContainer = document.getElementById("emoji-picker-container")
    const typingIndicator = document.getElementById("typing-indicator")
    const toggleThemeButton = document.getElementById("toggle-theme")
    const toggleThemeMobileButton = document.getElementById("toggle-theme-mobile")
    const toggleSidebarButton = document.getElementById("toggle-sidebar")
    const sidebar = document.getElementById("sidebar")
    const searchInput = document.getElementById("search-users")
    const currentRoomElement = document.getElementById("current-room")
  
    // Templates
    const messageTemplate = document.getElementById("message-template")
    const fileMessageTemplate = document.getElementById("file-message-template")
  
    // State
    let currentRoom = "general"
    let typingTimeout = null
    let isTyping = false
    let darkMode = localStorage.getItem("darkMode") === "true"
    let lastMessageDate = null // Add a global variable to hold the last message date during load.
  
    // Apply dark mode if enabled
    if (darkMode) {
      document.body.classList.add("dark-mode")
      toggleThemeButton.querySelector("i").classList.replace("fa-moon", "fa-sun")
      toggleThemeMobileButton.querySelector("i").classList.replace("fa-moon", "fa-sun")
      toggleThemeButton.querySelector("span").textContent = "Light Mode"
    }
  
    // Initialize tabs
    const tabs = document.querySelectorAll(".tab")
    const tabContents = document.querySelectorAll(".tab-content")
  
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.getAttribute("data-tab")
  
        // Update active tab
        tabs.forEach((t) => t.classList.remove("active"))
        tab.classList.add("active")
  
        // Show corresponding tab content
        tabContents.forEach((content) => {
          if (content.id === `${tabName}-tab`) {
            content.classList.remove("hidden")
          } else {
            content.classList.add("hidden")
          }
        })
      })
    })

    document.querySelectorAll(".user-item").forEach((item) => {
      item.addEventListener("click", () => {
        const otherUserId = item.getAttribute("data-user-id");
        // Create a private room name by sorting the two IDs so the room name is consistent
        const roomIds = [userId, otherUserId].sort();
        const privateRoom = `private_${roomIds[0]}_${roomIds[1]}`;

        // Leave the current room and join the private room
        socket.emit("leave", { room: currentRoom });
        socket.emit("join", { room: privateRoom });

        // Update current room state and UI text
        currentRoom = privateRoom;
        currentRoomElement.textContent = `Private Chat with ${item.querySelector("h4").textContent}`;

        // Load messages for the new private room
        loadMessages();
      });
    });
  
    // Toggle sidebar on mobile
    toggleSidebarButton.addEventListener("click", () => {
      sidebar.classList.toggle("open")
    })
  
    // Toggle dark mode
    function toggleDarkMode() {
      darkMode = !darkMode
      document.body.classList.toggle("dark-mode")
      localStorage.setItem("darkMode", darkMode)
  
      // Update icons
      const moonIcon = "fa-moon"
      const sunIcon = "fa-sun"
  
      if (darkMode) {
        toggleThemeButton.querySelector("i").classList.replace(moonIcon, sunIcon)
        toggleThemeMobileButton.querySelector("i").classList.replace(moonIcon, sunIcon)
        toggleThemeButton.querySelector("span").textContent = "Light Mode"
      } else {
        toggleThemeButton.querySelector("i").classList.replace(sunIcon, moonIcon)
        toggleThemeMobileButton.querySelector("i").classList.replace(sunIcon, moonIcon)
        toggleThemeButton.querySelector("span").textContent = "Dark Mode"
      }
    }
  
    toggleThemeButton.addEventListener("click", toggleDarkMode)
    toggleThemeMobileButton.addEventListener("click", toggleDarkMode)
  
    // Search users
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase()
      const userItems = document.querySelectorAll(".user-item")
  
      userItems.forEach((item) => {
        const username = item.querySelector("h4").textContent.toLowerCase()
        if (username.includes(searchTerm)) {
          item.style.display = "flex"
        } else {
          item.style.display = "none"
        }
      })
    })
  
    // Format timestamp
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  
    // Create message element
    function createMessageElement(message) {
      // Create the message container
      const messageElement = document.createElement("div");
      messageElement.classList.add("message");
      // Set message id attribute for deletion purpose.
      messageElement.setAttribute("data-message-id", message.id);
      
      if (message.user_id === currentUserID) {
        messageElement.classList.add("sent");
      } else {
        messageElement.classList.add("received");
      }
      
      // Create content container
      const contentEl = document.createElement("div");
      contentEl.className = "message-content";
      
      // Render based on message type
      if (message.type === "text") {
        contentEl.textContent = message.content;
      } else if (message.type === "sticker") {
        const stickerEl = document.createElement("div");
        stickerEl.className = "sticker";
        stickerEl.innerText = message.content;
        contentEl.appendChild(stickerEl);
      } else {
        contentEl.textContent = message.content;
      }
      
      messageElement.appendChild(contentEl);
      
      // Add delete button only for current user's messages
      if (message.user_id === currentUserID) {
        const deleteButton = document.createElement("button");
        deleteButton.classList.add("delete-button");
        deleteButton.title = "Delete";
        deleteButton.innerHTML = `<i class="fas fa-trash"></i>`;
        deleteButton.addEventListener("click", () => {
          if (confirm("Are you sure you want to delete this message?")) {
            socket.emit("delete_message", { message_id: message.id, room: currentRoom });
          }
        });
        messageElement.appendChild(deleteButton);
      }
      
      // Timestamp element
      const timeEl = document.createElement("div");
      timeEl.className = "timestamp";
      const dateObj = new Date(message.timestamp);
      timeEl.textContent = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      messageElement.appendChild(timeEl);
      
      return messageElement;
    }
  
    // Load messages for the current room using the API
    function loadMessages() {
        lastMessageDate = null; // reset day comparison
        messagesContainer.innerHTML = "";
        
        fetch(`/api/messages?room=${currentRoom}`)
          .then(response => response.json())
          .then(data => {
              // Assuming the API returns { messages: [...] }
              let messages = data.messages || [];
              
              // Sort messages in chronological order
              messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              
              messages.forEach(message => {
                  const msgDate = new Date(message.timestamp).toDateString();
                  if (lastMessageDate !== msgDate) {
                      // Insert a date divider when the day changes
                      const divider = document.createElement("div");
                      divider.className = "date-divider";
                      divider.textContent = msgDate;
                      messagesContainer.appendChild(divider);
                      lastMessageDate = msgDate;
                  }
                  const msgElement = createMessageElement(message);
                  messagesContainer.appendChild(msgElement);
              });
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
          })
          .catch((err) => {
              console.error("Error loading messages:", err);
          });
    }
  
    // Send message
    function sendMessage() {
      const message = messageInput.value.trim()
  
      if (message) {
        socket.emit("message", {
          message: message,
          room: currentRoom,
          type: "text",
        })
  
        messageInput.value = ""
        messageInput.focus()
      }
    }
  
    // Upload file
    function uploadFile(file) {
      const formData = new FormData()
      formData.append("file", file)
  
      fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.url) {
            socket.emit("message", {
              message: "Sent a file",
              room: currentRoom,
              type: "file",
              file_url: data.url,
            })
          }
        })
        .catch((error) => {
          console.error("Error uploading file:", error)
          alert("Error uploading file. Please try again.")
        })
    }
  
    // Handle typing indicator
    function handleTyping() {
      if (!isTyping) {
        isTyping = true
        socket.emit("typing", {
          room: currentRoom,
          isTyping: true,
        })
      }
  
      clearTimeout(typingTimeout)
  
      typingTimeout = setTimeout(() => {
        isTyping = false
        socket.emit("typing", {
          room: currentRoom,
          isTyping: false,
        })
      }, 2000)
    }
  
    // Event listeners
    sendButton.addEventListener("click", sendMessage)
  
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage()
      }
      handleTyping()
    })
  
    attachmentButton.addEventListener("click", () => {
      fileInput.click()
    })
  
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        uploadFile(fileInput.files[0])
        fileInput.value = ""
      }
    })
  
    emojiButton.addEventListener("click", (e) => {
      e.stopPropagation();
      removeEmojiPicker();  // Remove any existing picker
      // Create a new emoji picker panel attached to the sticker button.
      const picker = document.createElement("div");
      picker.className = "emoji-picker";
      // Use sample emojis; you can later replace these with Emoji-Mart for a richer set.
      sampleEmojis.forEach(emoji => {
        let emojiElem = document.createElement("span");
        emojiElem.className = "emoji";
        emojiElem.textContent = emoji;
        emojiElem.addEventListener("click", (evt) => {
          evt.stopPropagation();
          // Send a new message of type "sticker" with the emoji in the "content" field.
          socket.emit("message", {
            content: emoji,       // Use 'content' so it’s rendered properly in createMessageElement
            room: currentRoom,
            type: "sticker"
          });
          removeEmojiPicker();
        });
        picker.appendChild(emojiElem);
      });
      // Position the picker relative to the sticker button.
      const rect = emojiButton.getBoundingClientRect();
      picker.style.top = (rect.bottom + window.scrollY) + "px";
      picker.style.left = (rect.left + window.scrollX) + "px";
      document.body.appendChild(picker);
    });
  
    // Function to remove any existing emoji picker panel.
    function removeEmojiPicker() {
      const existingPicker = document.querySelector('.emoji-picker');
      if (existingPicker) {
        existingPicker.remove();
      }
    }
  
    document.addEventListener("click", (e) => {
      if (!e.target.classList.contains("emoji")) {
        removeEmojiPicker();
      }
    });
  
    // Room selection
    document.querySelectorAll(".chat-item").forEach((item) => {
      item.addEventListener("click", () => {
        const room = item.getAttribute("data-room")
  
        // Update active room
        document.querySelectorAll(".chat-item").forEach((i) => i.classList.remove("active"))
        item.classList.add("active")
  
        // Leave current room and join new room
        socket.emit("leave", { room: currentRoom })
        socket.emit("join", { room })
  
        // Update current room
        currentRoom = room
        currentRoomElement.textContent = item.querySelector("h4").textContent
  
        // Load messages for new room
        loadMessages()
      })
    })
  
    // Socket.IO event handlers
    socket.on("connect", () => {
      console.log("Connected to server")
  
      // Join default room
      socket.emit("join", { room: currentRoom })
  
      // Load messages
      loadMessages()
    })
  
    socket.on("message", (message) => {
      const isSent = message.user_id === userId
      const messageElement = createMessageElement(message, isSent)
      messagesContainer.appendChild(messageElement)
  
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    })
  
    socket.on("typing", (data) => {
      if (data.isTyping) {
        typingIndicator.textContent = `${data.username} is typing...`
      } else {
        typingIndicator.textContent = ""
      }
    })
  
    socket.on("message_deleted", (data) => {
      const msgEl = document.querySelector(`[data-message-id="${data.message_id}"]`);
      if (msgEl) {
        msgEl.remove();
      }
    })
  
    socket.on("user_status", (data) => {
      const userItem = document.querySelector(`.user-item[data-user-id="${data.user_id}"]`)
      if (userItem) {
        const statusElement = userItem.querySelector(".status")
        statusElement.textContent = data.status === "online" ? "Online" : "Offline"
        statusElement.classList.remove("online", "offline")
        statusElement.classList.add(data.status)
      }
    })

    // Hard-coded sample emojis; you can replace this with Emoji-Mart integration later.
    const sampleEmojis = ["👍", "😂", "❤️", "😮", "😢", "😡"];

    // Get current user ID from the page
    const userId = document.querySelector(".user-profile").getAttribute("data-user-id")
  })
