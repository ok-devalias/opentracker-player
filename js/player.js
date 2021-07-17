var player;
var NEXT_MOD_URL = '/get/mod';
var PLAYLIST_URL = '/get/playlist';
var repeats = 0;
var getNext = NEXT_MOD_URL;
var ID_PARAM = '?id=';
var FILENAME_PARAM = '?filename=';
var HANDLE_PARAM = '?handle=';
var KEY_PARAM = '?key=';
var BASE_URL = window.location.origin;
var curPlaylist = [];
var curIdx = 0;
var fileName = '';
built = false;

window.onerror = function () {
  var searchBtn = $('#search-btn');
  if (searchBtn.hasClass('active')) {
    searchBtn.toggleClass('active');
  }
  randomPlay(NEXT_MOD_URL);
}

jQuery(document).ready(function() {
  jQuery('.scrollbar-rail').scrollbar();
  $('#search-btn').on('click', function() {
    $(this).toggleClass('active');
    var searchId = $('#search-id').val();
    var searchHandle = $('#search-handle').val();
    var searchFilename = $('#search-filename').val();
    if (searchId.length > 0) {
      queryParams = ID_PARAM + searchId;
    } else if (searchFilename.length > 0) {
      queryParams = FILENAME_PARAM + searchFilename;
    } else if (searchHandle.length > 0) {
      queryParams = HANDLE_PARAM + searchHandle;
    } else {
      randomPlay(NEXT_MOD_URL);
      return;
    }
    if (queryParams.includes('?handle=')) {
      getPlaylist(PLAYLIST_URL + queryParams);
      return;
    }
    randomPlay(NEXT_MOD_URL + queryParams);
  });
});

function init() {
  if (typeof player === 'undefined') {
    player = new ChiptuneJsPlayer(new ChiptuneJsConfig(repeats));
  } else {
    stopButton();
  }
  var searchBtn = $('#search-btn');
  if (!searchBtn.hasClass('active')) {
    searchBtn.toggleClass('active');
  }
  player.handlers = [];
  if (curPlaylist.length > 0) {
    player.addHandler('onEnded', function() {metadata = undefined;
    modinfo = undefined; playlistPlay() });
  } else {
    player.addHandler('onEnded', function() { metadata = undefined;
    modinfo = undefined; randomPlay(NEXT_MOD_URL) });
  }
  built = false;
}

// mod metadata: artist, TMA hits, TMA link
function setStoredMetadata(modinfo) {
  var metadataKeys = ["artisthandle", "filename", "filesize", "hits", "tmaurl", "tmaid"];
  metadataKeys.forEach(function(key) {
		if (modinfo[key] != null) {
      if (key == "tmaid") {
			  el = document.getElementById("mute");
        if (el != null) {
          el.setAttribute("onclick", "randomPlay('"+ NEXT_MOD_URL + "?mute=" + modinfo[key] + "')" );
        }
			}
			el = document.getElementById(key);
      if (key == "tmaurl") {
        el = el.childNodes[0];
        el.href = modinfo[key];
      }
			if (el == null) return;
			el.innerHTML = modinfo[key];
		}
	});
  if (modinfo["tmaid"] == "null") {
    $(".modarchive").addClass('hidden')
  } else {
    $(".modarchive").removeClass('hidden')
  }
}

function stopButton() {
  player.onEnded = null;
  metadata = undefined;
  modinfo = undefined;
  player.stop();
}

function pauseButton() {
  player.togglePause();
  switchPauseButton();
}

function switchPauseButton() {
  var el = document.getElementById("playpause-btn");
  if (el.className.indexOf("fa-pause") > -1) {
	  el.className = el.className.replace(/(?:^|\s)fa-pause(?!\S)/g, ' fa-play');
  } else {
	  el.className = el.className.replace(/(?:^|\s)fa-play(?!\S)/g, ' fa-pause');
  }
}

function nextMod(target, callback) {
	var player = this;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', target, true);
	xhr.responseType = 'text';
  xhr.setRequestHeader ("Accept", "text/plain");
	xhr.onload = function(e) {
    if (xhr.status === 200) {
      return callback(xhr.response);
    } else {
      player.fireEvent('onError', {type: 'onxhr'});
    }
  }.bind(this);
  xhr.onerror = function() {
    player.fireEvent('onError', {type: 'onxhr'});
  };
  xhr.onabort = function() {
    player.fireEvent('onError', {type: 'onxhr'});
  };
  xhr.send();
}

function randomPlay(path) {
  init();
  target = BASE_URL + path;
  nextMod(target, function(buffer) {
    modinfo = JSON.parse(buffer);
    stream =  modinfo['streamurl'];
    player.load(stream, function(buffer) {
      player.play(buffer);
      player.togglePause(); // temporary pause for pattern data to build
      shouldStartPlayback();
    });
    setStoredMetadata(modinfo);
  });
}

function playlistPlay() {
  var key = curPlaylist.shift();
  var target = NEXT_MOD_URL + KEY_PARAM + key;
  var text_link_el = document.getElementById("nextSong");
  var icon_link_el = document.getElementById("next");
  if (curPlaylist.length > 0) {
    text_link_el.setAttribute("onclick", "playlistPlay()");
    icon_link_el.setAttribute("onclick", "playlistPlay()");
  } else {
    text_link_el.setAttribute("onclick", "randomPlay(\"" + NEXT_MOD_URL + "\")" );
    icon_link_el.setAttribute("onclick", "randomPlay(\"" + NEXT_MOD_URL + "\")" );
  }
  randomPlay(target);
}

function getPlaylist(path) {
  var target = BASE_URL + path;
  nextMod(path, function(buffer) {
    curPlaylist = JSON.parse(buffer).keys;
    if (curPlaylist.length > 0) {
      playlistPlay();
    } else {
      randomPlay(NEXT_MOD_URL);
    }
  });
}

function shouldStartPlayback() {
  playbackTimeout = setTimeout(function() {
    if (built) {
      $('#search-btn').toggleClass('active');
      mSetOrderRow(player.currentPlayingNode.modulePtr, 0, 0); // ensure playback starts at 0, due to play->pause
      player.togglePause(); // start playback again.
      return;
    }
    shouldStartPlayback();
  }, 100);
}

var commands = {
  NEXT_ORDER: 43,
  PREV_ORDER: 45
}
// Catch keypress events outside of input fields, map to tracker functions.
$(function() {
    $(document).keypress(function(e) {
        if ($(e.target).is('input, textarea')) {
            return;
        }
        if (e.which === commands.NEXT_ORDER) mSetOrderRow(player.currentPlayingNode.modulePtr, mGetCurOrder(player.currentPlayingNode.modulePtr)+1, 0);
        if (e.which === commands.PREV_ORDER) mSetOrderRow(player.currentPlayingNode.modulePtr, mGetCurOrder(player.currentPlayingNode.modulePtr)-1, 0);
    });
});

var fileaccess = document.querySelector('*');
fileaccess.ondrop = function(e) {
   e.preventDefault();
   var file = e.dataTransfer.files[0];
   fileName = file.name;
   init();
   player.load(file, function(buffer) {
     player.play(buffer);
     player.togglePause();
     shouldStartPlayback();
   });
};

fileaccess.ondragenter = function(e){e.preventDefault();};
fileaccess.ondragover = function(e){e.preventDefault();};
