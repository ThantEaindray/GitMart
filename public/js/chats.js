var uId = localStorage.getItem('loggedInUserId');

// Chat text is free-typed by whoever sent it, so building the bubble via
// innerHTML string concatenation (as this used to) would let a message
// like "<img src=x onerror=...>" execute in the recipient's browser the
// moment the chat loads. textContent keeps it inert.
//
// Chat images are served from a separately-uploaded SCP host (see
// image.controller.js), and a live WS/notification push can reach the
// recipient a beat before that file is actually readable there, so the
// very first <img> load can 404 with nothing to retry it — which is what
// "images only show up after a refresh" actually was: the refresh's own
// request just happened to land later, once the file existed. Retrying a
// few times with backoff turns that into "shows up a moment late" instead.
const IMAGE_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

function buildRetryingImage(src) {
  const img = document.createElement('img');
  img.className = 'msg-img';

  let attempt = 0;
  img.addEventListener('error', function onImageError() {
    if (attempt >= IMAGE_RETRY_DELAYS_MS.length) return;
    const delay = IMAGE_RETRY_DELAYS_MS[attempt];
    attempt += 1;
    setTimeout(function retryLoad() {
      // A fresh query param, not a reassignment of the same src, since some
      // browsers won't re-request a URL that just failed unless it changes.
      img.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'retry=' + Date.now();
    }, delay);
  });

  img.src = src;
  return img;
}

function buildMessageElement(side, contType, cont) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ' + side;

  if (contType === 'txt') {
    const bubble = document.createElement('span');
    bubble.className = 'msg-bubble';
    bubble.textContent = cont;
    wrapper.appendChild(bubble);
  } else {
    wrapper.appendChild(buildRetryingImage(cont));
  }

  return wrapper;
}

function loadChat(data) {
  const messages = document.getElementById('messages');
  messages.innerHTML = '';
  data.forEach(function (e) {
    var side = e.sender_id == uId ? 'sent' : 'received';
    messages.appendChild(buildMessageElement(side, e.cont_type, e.cont));
  });
  messages.scrollTop = messages.scrollHeight;
}

function viewChat(cId, wUsr) {
  //ok so we need to get the stuff from one specific chat now
  // so the chat id will be pulled from the request in the function and then we get the users id from inside of the thing itself
  //we also wanna pass the chat id into the localStorage for future use
  // also the id of the user were chatting with
  localStorage.setItem('with', wUsr);
  localStorage.setItem('openChat', cId);
  document.getElementById('chatwith').innerHTML = `<h2>Now Chatting</h2>`;
  fetchMethod(
    `/api/chats/viewChat/${cId}`,
    (stat, data) => {
      if (stat == 200) {
        loadChat(data);
      } else if (stat == 401 || stat == 403) {
        window.location.href = './login.html';
      }
    },
    'GET',
  );
}

//so we need to get the users chats
function renderChats(results) {
  //this will assemble everything into its bits of info with the functions to call to load their individual chats as well
  //in a perfect world itd be async but time
  results.forEach(function (e) {
    document.getElementById('chats').innerHTML += `
      <div class="chat-item" id="chat-${e.chat}" onclick="viewChat(${e.chat},${e.toId})">
        <i class="bi bi-person-circle chat-item-icon"></i>
        <span class="chat-item-name">${e.username}</span>
      </div>
    `;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  //check for a logged in user
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = './login.html';
    return;
  }

  document.getElementById('input-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendTxt(document.getElementById('message').value);
  });

  fetchMethod(
    '/api/chats',
    (stat, data) => {
      if (stat == 200) {
        renderChats(data);
        openChatFromQueryParams();
      } else if (stat == 401) {
        window.location.href = './login.html';
        console.error('problem loading chat list');
      }
    },
    'GET',
    null,
    token,
  );
  //and now we wanna make the part where it loads a specific chat based on what someone presses
});

// A "new message" notification links here as
// chats.html?chat=<id>&with=<userId> so clicking it opens straight into that
// conversation, instead of just the chat list — viewChat() needs both to
// render the right chat (it doesn't look the other participant up itself).
function openChatFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const chatId = params.get('chat');
  const withId = params.get('with');

  if (!chatId || !withId) return;

  viewChat(Number(chatId), Number(withId));
}
