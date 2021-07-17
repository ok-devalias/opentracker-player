var app = angular.module( "ompt-admin", [] );
player = new ChiptuneJsPlayer(new ChiptuneJsConfig(0));
mod_file = null;
var UPLOAD_URL = "http://uploader.opentracker-player.appspot.com/";

// shorter calls for frequent emscripten'd functions
var cpn = player.currentPlayingNode;
var mPtrToString = Module.Pointer_stringify;
var mGetMetadata = Module._openmpt_module_get_metadata;
var mGetInstrumentName = Module._openmpt_module_get_instrument_name;

var fileSize = 0;
var fileName = '';
// ensure that Chiptune2js player is initialized and is not paused or
// loading module data.
function playerAvailable() {
 if (typeof player === 'undefined') return false;
 if (typeof cpn === 'undefined' || cpn === null) return false;
 if (typeof cpn.paused === 'undefined' || cpn.paused === null) return false;
 if (cpn.modulePtr === null) return false;
 return true;
}

window.onerror = function () {
  var uploadBtn = $('#upload-btn');
  if (uploadBtn.hasClass('active')) {
    uploadBtn.toggleClass('active');
  }
}

jQuery(document).ready(function() {
  jQuery('.scrollbar-rail').scrollbar();
  $('#upload-btn').on('click', function() {
    //$(this).toggleClass('active');
  });
});

function init() {
  if (typeof player === 'undefined') {
    player = new ChiptuneJsPlayer(new ChiptuneJsConfig(0));
  }
  player.handlers = [];
  built = false;
}

// get value from key
function getMetadataByKey(key) {
  keyBuf = Module._malloc(key.length + 1);
  Module.writeStringToMemory(key, keyBuf);
  valBuf = mPtrToString(mGetMetadata(cpn.modulePtr, keyBuf));
  Module._free(keyBuf);
  return valBuf;
}

function getInstrumentText() {
  var text = '';
  num = Module._openmpt_module_get_num_instruments(cpn.modulePtr);
  for (i=0; i<num; i++) {
    name = mPtrToString(mGetInstrumentName(cpn.modulePtr, i));
    if (name.length > 0) text += '\n' + name;
  }
  return text;
}

function humanizeBytes(size) {
  human = '';
  denom = '';
  var KILO = 1024;
  var MEGA = 1024 * 1024;
  if (size < KILO) {
    denom = 'B';
    human = size;
  } else if (size >= KILO && size < MEGA) {
    denom = 'KB';
    human = size / KILO;
  } else if (size >= MEGA) {
    denom = 'MB';
    human = size / MEGA;
  }
  return human.toFixed(2) + denom;
}

function sendMod(fhandle, fname, fsize, frelease, ftitle, ftype, fmod) {
  var fd = new FormData();
  fd.append('artisthandle', fhandle);
  fd.append('filename', fname);
  fd.append('filesize', fsize);
  fd.append('releasedate', frelease);
  fd.append('songtitle', ftitle);
  fd.append('format', ftype);
  fd.append('instrumenttext', getInstrumentText());
  fd.append('mod', fmod);
  $.ajax({
    url: UPLOAD_URL,
    type: "POST",
    data: fd,
    cache: false,
    contentType: false,
    processData: false
  })
}

app.factory('ModInfo', function(){
  return {
    data: {
      artisthandle: ''
    }
  }
});

app.controller(
  "SongMetaData",
  function($scope, $interval, ModInfo) {
    $scope.data = ModInfo.data;
    $scope.title = '';
    $scope.trackerType = '';
    $scope.message_raw = '';
    $scope.instrumenttext = '';
    $scope.artisthandle = '';
    $scope.filename = '';
    $scope.mod_format = '';
    $scope.releaseDate = '';
    $scope.filesize = '';

    $scope.sender = function() {
      sendMod($scope.data.artisthandle, $scope.filename, $scope.filesize, $scope.releaseDate, $scope.title, metadata.type, mod_file)
    }

    var fileaccess = document.querySelector('*');
    fileaccess.ondrop = function(e) {
       e.preventDefault();
       clearMetaData();
       var file = e.dataTransfer.files[0];
       mod_file = file;
       init();
       player.load(file, function(buffer) {
         player.play(buffer);
         cpn = player.currentPlayingNode;
         player.togglePause();
         metadata = player.metadata();
         $scope.filesize = humanizeBytes(file.size);
         $scope.filename = file.name;
         $scope.releaseDate = new Date(file.lastModified).toISOString().split('T')[0];
       });
    };

    fileaccess.ondragenter = function(e){e.preventDefault();};
    fileaccess.ondragover = function(e){e.preventDefault();};

    stopSongMetaData = $interval(function() {
      if (!playerAvailable()) {
        clearMetaData();
        return;
      }

      //$('input').prop('disabled', function(i,v){return !v});
      if (typeof metadata === "undefined") {
        metadata = player.metadata();
      }

      $scope.title = metadata['title'];
      $scope.trackerType = metadata['tracker'];
      $scope.message_raw = getMetadataByKey('message_raw');
      $scope.instrumenttext = getInstrumentText();
      $scope.mod_format = getMetadataByKey('type');
    }, 100);

    function clearMetaData() {
      $scope.title = '';
      $scope.trackerType = '';
      $scope.message_raw = '';
      $scope.instrumenttext = '';
      $scope.data.artisthandle = '';
      $scope.filename = '';
      $scope.mod_format = '';
      $scope.releaseDate = '';
      $scope.filesize = '';
      fileSize = 0;
      fileName = '';
      metadata = undefined;
    }

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      $scope.stopIntervals();
    });

    $scope.stopIntervals = function() {
      if (angular.isDefined(stopSongMetaData)) {
        $interval.cancel(stopSongMetaData);
        stopSongMetaData = undefined;
      }
    };
  }
);

app.controller('InputData', function($scope, ModInfo){
  $scope.data = ModInfo.data;
});
