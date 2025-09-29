// ---------------- GLOBALS ----------------
const backendUrl = "https://nagris-backend.onrender.com";
let currentProfileUsername = null; // ✅ declare before using
console.log("script.js loaded");

// ---------------- TOKEN HELPERS ----------------
function saveToken(token) {
  localStorage.setItem("token", token);
}
function getToken() {
  return localStorage.getItem("token");
}
function clearToken() {
  localStorage.removeItem("token");
}
function authHeader() {
  const token = getToken();
  return token ? { Authorization: "Bearer " + token } : {};
}
function requireLogin() {
  if (!getToken()) {
    showNotification("⚠️ Please login first", "error");
    return false;
  }
  return true;
}

// ---------------- NOTIFICATION ----------------
function showNotification(message, type = "success") {
  const container = document.getElementById("notification-container");
  if (!container) return;
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.textContent = message;
  container.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

// ---------------- PROFILE HELPERS ----------------
function renderUserList(usernames = [], listId) {
  const ul = document.getElementById(listId);
  ul.innerHTML = "";
  if (!usernames?.length) {
    ul.innerHTML = "<li>— none —</li>";
    return;
  }
  usernames.forEach((uname) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="#" class="user-link">@${uname}</a>`;
    li.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      loadProfile(uname); // 👈 clicking jumps to that user’s profile
    });
    ul.appendChild(li);
  });
}

// Format timestamps into "2m ago", "3h ago", etc.
function timeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now - then) / 1000); // seconds

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return then.toLocaleDateString();
}
// ----- TABS & SECTIONS -----

// Grab tab buttons
const feedTabBtn = document.getElementById("feed-tab");
const myVideosTabBtn = document.getElementById("my-videos-tab");
const notificationsTabBtn = document.getElementById("notifications-tab");

// Helper: set active tab
function setActiveTab(btn) {
  document.querySelectorAll(".tabs .tab").forEach(tab => tab.classList.remove("active"));
  btn.classList.add("active");
}

// Helper: show section
function showSection(sectionId) {
  document.getElementById("video-feed").style.display = "none";
  document.getElementById("my-videos").style.display = "none";
  document.getElementById("notifications").style.display = "none";

  document.getElementById(sectionId).style.display = "block";
}

// Feed tab
feedTabBtn.addEventListener("click", () => {
  setActiveTab(feedTabBtn);
  showSection("video-feed");
  loadVideos(); // refresh feed
});

// My Videos tab
myVideosTabBtn.addEventListener("click", () => {
  setActiveTab(myVideosTabBtn);
  showSection("my-videos");
  if (typeof loadMyVideos === "function") loadMyVideos();
});

// Notifications tab
notificationsTabBtn.addEventListener("click", async () => {
  if (!getToken()) {
    showNotification("⚠️ Please login to see notifications", "warning");
    return;
  }

  setActiveTab(notificationsTabBtn);
  showSection("notifications");

  // Load notifications normally
  if (typeof loadNotifications === "function") {
    await loadNotifications();
  }

  // ✅ Mark all as read when opening tab
  await fetch(`${backendUrl}/notifications/read`, {
    method: "POST",
    headers: { ...authHeader() }
  }).catch(err => console.error("Mark all read error:", err));

  // ✅ Clear badge
  setNotifBadge(0);
});

// ---------------- USER INFO ----------------
async function showCurrentUser() {
  const token = getToken();
  const userInfo = document.getElementById("current-user");
  const logoutBtn = document.getElementById("logout-btn");

  if (!token) {
    userInfo.textContent = "Not logged in";
    logoutBtn.style.display = "none";
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/auth/me`, { headers: { ...authHeader() } });
    if (!res.ok) throw new Error("Invalid token");

    const user = await res.json();
    userInfo.textContent = `Logged in as: ${user.username} (${user.email})`;
    logoutBtn.style.display = "inline-block";
  } catch (err) {
    userInfo.textContent = "Session expired. Please login again.";
    logoutBtn.style.display = "none";
    clearToken();
  }
}
// ---------------- REGISTER ----------------
document.getElementById("register-btn").addEventListener("click", async () => {
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value.trim();

  try {
    const res = await fetch(`${backendUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      showNotification("✅ Registered successfully! Please login manually.", "success");
      // ❌ No auto-login anymore
    } else {
      showNotification("❌ Error: " + (data.error || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("Register error:", err);
    showNotification("❌ Failed to register", "error");
  }
});

// ---------------- LOGIN ----------------
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    const res = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.token) {
      saveToken(data.token);
      showNotification("✅ Login successful!", "success");

      // 🔑 Fetch logged-in user
      const meRes = await fetch(`${backendUrl}/auth/me`, { headers: { ...authHeader() } });
      if (meRes.ok) {
        window.currentUser = await meRes.json();
        showCurrentUser();

        // 👇 Update profile header immediately
        document.getElementById("profile-username").textContent = "@" + window.currentUser.username;
        document.getElementById("profile-bio").textContent = window.currentUser.bio || "No bio yet";
        document.getElementById("profile-avatar").src = window.currentUser.avatar || "https://placehold.co/100x100";
      }

      if (window.currentUser?.username) loadProfile(window.currentUser.username);
      loadVideos();
    } else {
      showNotification("❌ Error: " + (data.error || "Invalid credentials"), "error");
    }
  } catch (err) {
    console.error("Login error:", err);
    showNotification("❌ Login failed. Try again.", "error");
  }
});
// ---------------- LOGOUT ----------------
document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  window.currentUser = null;

  // Reset profile header
  document.getElementById("profile-username").textContent = "@username";
  document.getElementById("profile-bio").textContent = "This is my bio...";
  document.getElementById("profile-avatar").src = "https://placehold.co/100x100";
  document.getElementById("profile").style.display = "none";
  document.getElementById("current-user").textContent = "Not logged in";

  // Reset counters
  document.getElementById("followers-count").textContent = "0";
  document.getElementById("following-count").textContent = "0";
  document.getElementById("followers-count-list").textContent = "0";
  document.getElementById("following-count-list").textContent = "0";

  // Hide follow/unfollow
  document.getElementById("follow-btn").style.display = "none";
  document.getElementById("unfollow-btn").style.display = "none";

  showNotification("✅ Logged out", "success");
  showCurrentUser();
  loadVideos();
});
// ---------------- NOTIFICATION BADGE ----------------
function setNotifBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// Fetch unread count from backend
async function fetchUnreadCount() {
  try {
    const res = await fetch(`${backendUrl}/notifications`, {
      headers: { ...authHeader() }
    });
    const data = await res.json();
    if (!Array.isArray(data)) return 0;

    return data.filter(n => !n.read).length;
  } catch (err) {
    console.error("Unread count fetch failed:", err);
    return 0;
  }
}

// INIT badge updater
(async () => {
  if (getToken()) {
    setNotifBadge(await fetchUnreadCount());
  }

  // Update every 30s if user is logged in
  setInterval(async () => {
    const isNotificationsVisible =
      document.getElementById("notifications").style.display === "block";

    if (!isNotificationsVisible && getToken()) {
      setNotifBadge(await fetchUnreadCount());
    }
  }, 30000);
})();

// ---------------- VIDEO FEED (Infinite Scroll TikTok style) ----------------
let currentPage = 1;
let totalPages = 1;
let loading = false;

async function loadVideos(page = 1, append = false) {
  if (loading || (page > totalPages && page !== 1)) return;
  loading = true;

  try {
    const res = await fetch(`${backendUrl}/videos?page=${page}&limit=5`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to load videos");

    const feed = document.getElementById("video-feed");
    if (!append) feed.innerHTML = "";

    (data.videos || []).forEach(video => {
      const div = document.createElement("div");
      div.className = "feed-item";
      div.dataset.id = video._id;

      div.innerHTML = `
  <div class="video">
    <video src="${video.src}" autoplay muted loop></video>
    <div class="actions">
      <div class="action">
        <button class="like-btn">❤️</button>
        <span class="like-count">${video.likes || 0}</span>
      </div>
      <div class="action">
        <button class="comment-btn">💬</button>
        <span class="comment-count">${video.comments?.length || 0}</span>
      </div>
      <div class="action">
        <button class="share-btn">🔗</button>
        <span class="share-count">${video.shares || 0}</span>
      </div>
    </div>

    <!-- 👇 Comment popup -->
    <div class="comment-section">
      <button class="close-comments">✖ Close</button>
      <ul class="comment-list"></ul>
      <input type="text" class="comment-input" placeholder="Write a comment...">
      <button class="send-comment">Send</button>
    </div>

    <!-- 👇 Overlay for closing when clicked outside -->
    <div class="overlay"></div>
  </div>
`;

      feed.appendChild(div);
    });

    attachEvents();
    setupAutoplay();
    setupSoundToggle();
    

    // update pagination
    currentPage = data.currentPage || page;
    totalPages = data.totalPages || page;
  } catch (err) {
    console.error("⚠️ loadVideos error:", err);
  } finally {
    loading = false;
  }
} 
// ---------------- MY VIDEOS ----------------
async function loadMyVideos() {
  if (!requireLogin()) return;

  try {
    const res = await fetch(`${backendUrl}/my-videos`, {
      headers: { ...authHeader() }
    });
    const videos = await res.json().catch(() => []);

    const grid = document.getElementById("my-videos-grid");
    grid.innerHTML = "";

    if (!Array.isArray(videos) || videos.length === 0) {
      grid.innerHTML = "<p>No videos uploaded yet.</p>";
      return;
    }

    videos.forEach(video => {
      const div = document.createElement("div");
      div.className = "my-video-item";
      div.innerHTML = `
        <video src="${video.src}" controls muted></video>
        <p>${video.title || "Untitled"}</p>
        <span>❤️ ${video.likes || 0} | 💬 ${(video.comments?.length) || 0} | 🔗 ${video.shares || 0}</span>
      `;
      grid.appendChild(div);
    });

  } catch (err) {
    console.error("⚠️ loadMyVideos error:", err);
    document.getElementById("my-videos-grid").innerHTML = "<p>Failed to load your videos</p>";
  }
}

// ---------------- AUTOPLAY (only one video at a time) ----------------
function setupAutoplay() {
  const options = {
    root: null,
    rootMargin: "0px",
    threshold: 0.7 // play when 70% visible
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting) {
        // Pause all other videos
        document.querySelectorAll("#video-feed video").forEach(v => {
          if (v !== video) v.pause();
        });

        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, options);

  // observe all videos
  document.querySelectorAll("#video-feed video").forEach(video => {
    observer.observe(video);
  });
}

// ---------------- SOUND TOGGLE ----------------
function setupSoundToggle() {
  document.querySelectorAll("#video-feed video").forEach(video => {
    video.muted = true; // always start muted

    video.addEventListener("click", () => {
      if (video.muted) {
        // mute all others
        document.querySelectorAll("#video-feed video").forEach(v => v.muted = true);

        video.muted = false;
        showNotification("🔊 Sound on", "success");
      } else {
        video.muted = true;
        showNotification("🔇 Sound off", "warning");
      }
    });
  });
}

// ---------------- DOUBLE TAP HEART TRAIL ----------------
function handleDoubleTap(video, event) {
  const videoDiv = video.closest(".video");
  if (!videoDiv) return;   // ✅ prevent error

  const videoId = videoDiv.dataset.id;
  const likeCount = videoDiv.querySelector(".like-count");

  // ❤️ Floating hearts trail
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement("div");
    heart.textContent = "❤️";
    heart.style.position = "absolute";
    heart.style.left = `${event.offsetX + (Math.random() * 40 - 20)}px`;
    heart.style.top = `${event.offsetY}px`;
    heart.style.fontSize = `${30 + Math.random() * 20}px`;
    heart.style.opacity = "1";
    heart.style.transform = "scale(1)";
    heart.style.transition = `transform 1s ease, opacity 1s ease`;
    heart.style.pointerEvents = "none";

    videoDiv.appendChild(heart);

    // Animate upwards
    setTimeout(() => {
      heart.style.transform = `translateY(-${80 + Math.random() * 40}px) scale(1.5)`;
      heart.style.opacity = "0";
    }, 50);

    setTimeout(() => heart.remove(), 1200);
  }

  // 🔗 Send like request to backend
  fetch(`${backendUrl}/videos/${videoId}/like`, {
    method: "PUT",   // ✅ matches backend
    headers: { ...authHeader() }
  })
    .then(res => res.json())
    .then(data => {
      if (data.likes !== undefined && likeCount) {
        likeCount.textContent = data.likes;
      }
    })
    .catch(err => console.error("Double-tap like error:", err));
}

// ---------------- LIKE TOGGLE ----------------
function attachEvents() {
  // ❤️ Like
  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!requireLogin()) return;
      const videoDiv = btn.closest("[data-id]");
      const videoId = videoDiv.dataset.id;
      await toggleLike(videoId, btn);
    };
  });

  // ❤️ Double-tap like on video
  document.querySelectorAll("video").forEach(videoEl => {
    videoEl.ondblclick = () => {
      const videoDiv = videoEl.closest("[data-id]");
      const likeBtn = videoDiv.querySelector(".like-btn");
      const videoId = videoDiv.dataset.id;
      toggleLike(videoId, likeBtn);
    };
  });
}

// ✅ Toggle like/unlike
async function toggleLike(videoId, btn) {
  try {
    const res = await fetch(`${backendUrl}/videos/${videoId}/like`, {
      method: "PUT",
      headers: { ...authHeader() }
    });
    if (!res.ok) return;

    const data = await res.json();

    // Update like count
    const likeCountEl = btn.closest("[data-id]").querySelector(".like-count");
    if (likeCountEl) {
      likeCountEl.textContent = data.likes;
    }

    // Toggle heart color
    if (data.likedBy.includes(window.currentUser.username)) {
      btn.classList.add("liked");
    } else {
      btn.classList.remove("liked");
    }
  } catch (err) {
    console.error("Like error:", err);
  }
}

// 💬 Open comments (with reply + like support)
document.querySelectorAll(".comment-btn").forEach(btn => {
  btn.onclick = async () => {
    const videoDiv = btn.closest("[data-id]");
    const videoId = videoDiv.dataset.id;
    const section = videoDiv.querySelector(".comment-section");
    const overlay = videoDiv.querySelector(".overlay");
    const list = videoDiv.querySelector(".comment-list");

    section.classList.add("active");
    overlay.style.display = "block";
    list.innerHTML = "";

    try {
      const res = await fetch(`${backendUrl}/videos/${videoId}/comments`);
      const comments = await res.json().catch(() => []);

      comments.forEach(c => renderComment(c, list));  // 👈 use new renderer

      // ✅ update counter
      videoDiv.querySelector(".comment-count").textContent = comments.length;
    } catch (err) {
      console.error("Load comments error:", err);
    }
  };
});

// ✖ Close comments
document.querySelectorAll(".close-comments").forEach(btn => {
  btn.onclick = () => {
    const videoDiv = btn.closest("[data-id]");
    const section = videoDiv.querySelector(".comment-section");
    const overlay = videoDiv.querySelector(".overlay");
    section.classList.remove("active");
    overlay.style.display = "none";
  };
});

// Close by clicking overlay
document.querySelectorAll(".overlay").forEach(overlay => {
  overlay.onclick = () => {
    const videoDiv = overlay.closest(".video");
    const section = videoDiv.querySelector(".comment-section");
    section.classList.remove("active");
    overlay.style.display = "none";
  };
});

// 📝 Send comment
document.querySelectorAll(".send-comment").forEach(btn => {
  btn.onclick = async () => {
    if (!requireLogin()) return;
    const videoDiv = btn.closest("[data-id]");
    const videoId = videoDiv.dataset.id;
    const input = videoDiv.querySelector(".comment-input");
    const list = videoDiv.querySelector(".comment-list");

    if (!input.value.trim()) return;

    try {
      const res = await fetch(`${backendUrl}/videos/${videoId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify({ text: input.value })
      });

      const comment = await res.json().catch(() => null);
      if (res.ok && comment) {
        renderComment(comment, list);   // 👈 replaces manual li
        input.value = "";

        // update counter
        const countEl = videoDiv.querySelector(".comment-count");
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;

        // auto scroll
        list.scrollTop = list.scrollHeight;
      }
    } catch (err) {
      console.error("Comment error:", err);
    }
  };
});

// ---------------- RENDER COMMENT ----------------
function renderComment(c, parentList) {
  const li = document.createElement("li");
  li.className = "comment-item";

  const time = new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  li.innerHTML = `
    <strong>@${c.author}</strong> ${c.text}
    <div class="comment-meta">
      <span class="time">${time}</span>
      <button class="reply-btn">Reply</button>
      <button class="like-comment-btn">❤️ ${c.likes || 0}</button>
    </div>
    <ul class="replies"></ul>
  `;

  // ❤️ Like comment
  li.querySelector(".like-comment-btn").onclick = async () => {
    try {
      const res = await fetch(`${backendUrl}/videos/${c.video}/comments/${c._id}/like`, {
        method: "POST",
        headers: { ...authHeader() }
      });
      const updated = await res.json();
      if (res.ok && updated.likes !== undefined) {
        li.querySelector(".like-comment-btn").textContent = `❤️ ${updated.likes}`;
      }
    } catch (err) {
      console.error("Comment like error:", err);
    }
  };

  // 💬 Reply to comment
  li.querySelector(".reply-btn").onclick = () => {
    const replyText = prompt("Write your reply:");
    if (!replyText) return;

    fetch(`${backendUrl}/videos/${c.video}/comments/${c._id}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader()
      },
      body: JSON.stringify({ text: replyText })
    })
    .then(res => res.json())
    .then(reply => {
      if (reply?.text) {
        renderComment(reply, li.querySelector(".replies"));
      }
    })
    .catch(err => console.error("Reply error:", err));
  };

  parentList.appendChild(li);

  // recursively render replies if exist
  if (c.replies?.length) {
    const repliesList = li.querySelector(".replies");
    c.replies.forEach(r => renderComment(r, repliesList));
  }
}

  // 🔗 Share
  document.querySelectorAll(".share-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!requireLogin()) return;
      const videoDiv = btn.closest("[data-id]");
      const videoId = videoDiv.dataset.id;
      const shareCount = videoDiv.querySelector(".share-count");

      try {
        const res = await fetch(`${backendUrl}/videos/${videoId}/share`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader()
          },
          body: JSON.stringify({ sharedBy: window.currentUser?.username || "Anonymous", platform: "App" })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.video) {
          shareCount.textContent = data.video.shares;
        }
      } catch (err) {
        console.error("Share error:", err);
      }
    };
  });

// ---------------- UPLOAD ----------------
document.getElementById("upload-btn").addEventListener("click", async () => {
  if (!requireLogin()) return;
  const title = document.getElementById("title").value.trim();
  const src = document.getElementById("src").value.trim();

  if (!title || !src) {
    showNotification("⚠️ Please fill in all fields", "warning");
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader()
      },
      body: JSON.stringify({ title, src }) // backend attaches uploadedBy
    });

    const data = await res.json().catch(() => ({}));
    console.log("📤 Upload response:", res.status, data);  // 👈 add this line

  if (res.ok) {
  showNotification("✅ Video uploaded successfully!", "success");
  loadVideos();
} else {
  showNotification("❌ Failed to upload video: " + (data.error || "Unknown error"), "error");
}

  } catch (err) {
    console.error("Upload error:", err);
    showNotification("❌ Upload failed", "error");
  }
});
// ---------------- PROFILE FETCH ----------------
async function loadProfile(username) {
  if (!username) {
    showNotification("Type a username first.", "error");
    return;
  }
  currentProfileUsername = username;

  try {
    const res = await fetch(`${backendUrl}/profile/${encodeURIComponent(username)}`);
    if (!res.ok) {
      showNotification("Profile not found.", "error");
      return;
    }
    const data = await res.json();

    // ✅ Update profile header
    document.getElementById("profile-username").textContent = "@" + data.username;
    document.getElementById("profile-bio").textContent = data.bio || "No bio yet";
    document.getElementById("profile-avatar").src = data.avatar || "https://placehold.co/100x100";

    // ✅ Show edit section only if logged in user === profile user
    if (window.currentUser && window.currentUser.username === username) {
      document.getElementById("edit-profile").style.display = "block";
      document.getElementById("edit-bio").value = data.bio || "";
      document.getElementById("edit-avatar").value = data.avatar || "";
    } else {
      document.getElementById("edit-profile").style.display = "none";
    }

    // ✅ Update counters
    document.getElementById("followers-count").textContent = data.followersCount || 0;
    document.getElementById("following-count").textContent = data.followingCount || 0;

    // ✅ User's videos
    const profileVideos = document.querySelector("#profile .profile-videos");
    if (profileVideos) {
      profileVideos.innerHTML = "";
      if (data.videos && data.videos.length) {
        data.videos.forEach(video => {
          const div = document.createElement("div");
          div.innerHTML = `<video src="${video.src}" controls muted></video>`;
          profileVideos.appendChild(div);
        });
      } else {
        profileVideos.innerHTML = "<p>No videos yet</p>";
      }
    }

    // ✅ Toggle Follow/Unfollow buttons
    const me = window.currentUser?.username;
    const followBtn = document.getElementById("follow-btn");
    const unfollowBtn = document.getElementById("unfollow-btn");

    if (!me || me === data.username) {
      followBtn.style.display = "none";
      unfollowBtn.style.display = "none";
    } else {
      const amIFollowing = data.followers.includes(me);
      followBtn.style.display = amIFollowing ? "none" : "inline-block";
      unfollowBtn.style.display = amIFollowing ? "inline-block" : "none";
    }

    // ✅ Show edit profile only if it's my profile
    const editSection = document.getElementById("edit-profile");
    if (me && me === data.username) {
      editSection.style.display = "block";
      document.getElementById("edit-bio").value = data.bio || "";
      document.getElementById("edit-avatar").value = data.avatar || "";
    } else {
      editSection.style.display = "none";
    }

  } catch (err) {
    console.error("⚠️ loadProfile error:", err);
    showNotification("❌ Failed to load profile", "error");
  }
}
// ---------------- AVATAR PREVIEW ----------------
const avatarInput = document.getElementById("edit-avatar");
const avatarPreview = document.getElementById("avatar-preview");

if (avatarInput && avatarPreview) {
  avatarInput.addEventListener("input", () => {
    const url = avatarInput.value.trim();
    if (url) {
      avatarPreview.src = url;
    } else {
      avatarPreview.src = "https://placehold.co/100x100"; // fallback
    }
  });
}

// ---------------- FOLLOW / UNFOLLOW ----------------
// ✅ Follow user
document.getElementById("follow-btn").addEventListener("click", async () => {
  if (!requireLogin() || !currentProfileUsername) return;
  try {
    const res = await fetch(`${backendUrl}/follow/${encodeURIComponent(currentProfileUsername)}`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (res.ok) {
      showNotification("✅ " + (data.message || "Followed"), "success");
      loadProfile(currentProfileUsername); // refresh profile
    } else {
      showNotification("❌ " + (data.error || "Failed to follow"), "error");
    }
  } catch (err) {
    console.error("Follow error:", err);
  }
});


// ✅ Unfollow user
document.getElementById("unfollow-btn").addEventListener("click", async () => {
  if (!requireLogin() || !currentProfileUsername) return;
  try {
    const res = await fetch(`${backendUrl}/unfollow/${encodeURIComponent(currentProfileUsername)}`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (res.ok) {
      showNotification("✅ " + (data.message || "Unfollowed"), "success");
      loadProfile(currentProfileUsername);
    } else {
      showNotification("❌ " + (data.error || "Failed to unfollow"), "error");
    }
  } catch (err) {
    console.error("Unfollow error:", err);
  }
});

// ---------------- SAVE PROFILE ----------------
document.getElementById("save-profile-btn").addEventListener("click", async () => {
  if (!requireLogin() || !currentProfileUsername) return;

  const newBio = document.getElementById("edit-bio").value.trim();
  const newAvatar = document.getElementById("edit-avatar").value.trim();

  try {
    const res = await fetch(`${backendUrl}/profile/${encodeURIComponent(currentProfileUsername)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeader()
      },
      body: JSON.stringify({ bio: newBio, avatar: newAvatar })
    });

   if (res.ok) {
  showNotification("✅ Profile updated", "success");

  // update local data
  if (window.currentUser) {
    window.currentUser.bio = newBio;
    window.currentUser.avatar = newAvatar;
  }

  // ✅ instantly update profile header
  document.getElementById("profile-bio").textContent = newBio || "No bio yet";
  document.getElementById("profile-avatar").src = newAvatar || "https://placehold.co/100x100";
  document.getElementById("avatar-preview").src = newAvatar || "https://placehold.co/100x100";

  // ✅ update top user info
  const userAvatarEl = document.getElementById("current-user-avatar");
  if (newAvatar) {
    userAvatarEl.src = newAvatar;
    userAvatarEl.style.display = "inline-block";
  } else {
    userAvatarEl.style.display = "none";
  }

} else {
  showNotification("❌ Failed to update profile", "error");
}

  } catch (err) {
    console.error("Profile update error:", err);
    showNotification("❌ Error updating profile", "error");
  }
});

// ---------------- PROFILE SEARCH EVENTS (with debug) ----------------
document.getElementById("search-profile-btn").addEventListener("click", async () => {
  const uname = document.getElementById("profile-search").value.trim();
  if (!uname) {
    showNotification("⚠️ Please enter a username", "warning");
    return;
  }

  console.log("🔍 Searching for profile:", uname);

  try {
    const res = await fetch(`${backendUrl}/profile/${encodeURIComponent(uname)}`, {
      headers: { ...authHeader() }
    });

    const data = await res.json().catch(() => ({}));
    console.log("📥 Search response:", res.status, data);

    if (res.ok) {
      loadProfile(uname);
    } else {
      showNotification("❌ Failed to load profile: " + (data.error || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("Search error:", err);
    showNotification("❌ Error searching profile", "error");
  }
});

document.getElementById("profile-search").addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const uname = e.target.value.trim();
    if (!uname) {
      showNotification("⚠️ Please enter a username", "warning");
      return;
    }

    console.log("🔍 Searching (Enter key) for profile:", uname);

    try {
      const res = await fetch(`${backendUrl}/profile/${encodeURIComponent(uname)}`, {
        headers: { ...authHeader() }
      });

      const data = await res.json().catch(() => ({}));
      console.log("📥 Search response (Enter key):", res.status, data);

      if (res.ok) {
        loadProfile(uname);
      } else {
        showNotification("❌ Failed to load profile: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      console.error("Search error (Enter key):", err);
      showNotification("❌ Error searching profile", "error");
    }
  }
});

// ---------------- GROUPING HELPER ----------------
function groupNotificationsByTime(notifications) {
  const groups = { today: [], yesterday: [], week: [], earlier: [] };
  const now = new Date();
  const todayDate = now.toDateString();

  notifications.forEach(n => {
    const created = new Date(n.createdAt);
    const notifDate = created.toDateString();

    if (notifDate === todayDate) {
      groups.today.push(n);
    } else {
      const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        groups.yesterday.push(n);
      } else if (diffDays <= 7) {
        groups.week.push(n);
      } else {
        groups.earlier.push(n);
      }
    }
  });

  return groups;
}

// ---------------- NOTIFICATIONS ----------------
async function loadNotifications() {
  if (!requireLogin()) return;

  try {
    const res = await fetch(`${backendUrl}/notifications`, {
      headers: { ...authHeader() }
    });

    const notifications = await res.json().catch(() => []);

    const container = document.getElementById("notifications");
    container.innerHTML = ""; // clear before reload

    if (!notifications.length) {
      container.innerHTML = "<p>No notifications yet</p>";
      return;
    }

    // Group notifications by time
    const groups = groupNotificationsByTime(notifications);

    function renderGroup(title, items) {
      if (!items.length) return;
      const header = document.createElement("h3");
      header.textContent = title;
      container.appendChild(header);

      items.forEach(notif => {
        const div = document.createElement("div");
        div.className = `notif ${notif.read ? "read" : "unread"}`;

        // choose an icon
        let icon = "🔔";
        if (notif.type === "like") icon = "❤️";
        if (notif.type === "comment") icon = "💬";
        if (notif.type === "reply") icon = "↩️";
        if (notif.type === "follow") icon = "👤";

        div.innerHTML = `
          <span class="notif-icon">${icon}</span>
          <span class="notif-text">${notif.message}</span>
          <span class="notif-time">${timeAgo(notif.createdAt)}</span>
        `;

        // click → mark as read
        div.onclick = async () => {
          try {
            const res = await fetch(`${backendUrl}/notifications/${notif._id}/read`, {
              method: "PUT",
              headers: { ...authHeader() }
            });
            if (res.ok) {
              div.classList.remove("unread");
              div.classList.add("read");
            }
          } catch (err) {
            console.error("Mark as read error:", err);
          }
        };

        container.appendChild(div);
      });
    }

    // render groups
    renderGroup("Today", groups.today);
    renderGroup("Yesterday", groups.yesterday);
    renderGroup("This Week", groups.week);
    renderGroup("Earlier", groups.earlier);

  } catch (err) {
    console.error("Notification fetch error:", err);
  }
}

// ---------------- INIT NOTIF BADGE ----------------
(async () => {
  if (getToken()) {
    setNotifBadge(await fetchUnreadCount());
  }

  // Update every 30s while not on Notifications tab
  setInterval(async () => {
    const isNotificationsVisible = document.getElementById("notifications").style.display === "block";
    if (!isNotificationsVisible && getToken()) {
      setNotifBadge(await fetchUnreadCount());
    }
  }, 30000);
})();

// ---------------- INFINITE SCROLL ----------------
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    loadVideos(currentPage + 1, true); // load next page, append
  }
});

// ---------------- INIT ----------------
(async () => {
  await showCurrentUser();
  try {
    const res = await fetch(`${backendUrl}/auth/me`, { headers: { ...authHeader() } });
    if (res.ok) {
      window.currentUser = await res.json();
      if (window.currentUser?.username) loadProfile(window.currentUser.username);
    } else {
      window.currentUser = null;
    }
  } catch {
    window.currentUser = null;
  }
  loadVideos();
  loadNotifications();
})();
