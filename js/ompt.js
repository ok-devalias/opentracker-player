
var app = angular.module( "ompt", [] );
// shorter calls for frequent emscripten'd functions
var mPtrToString = Module.Pointer_stringify;
var mSetOrderRow = Module._openmpt_module_set_position_order_row;
var mGetNumOrders = Module._openmpt_module_get_num_orders;
var mGetNumPatternRows = Module._openmpt_module_get_pattern_num_rows;
var mGetOrderPattern = Module._openmpt_module_get_order_pattern;
var mGetCurOrder = Module._openmpt_module_get_current_order;
var mGetCurRow = Module._openmpt_module_get_current_row;
var mFormatChannel =  Module._openmpt_module_format_pattern_row_channel; // needs Stringify
var mGetActiveChannels = Module._openmpt_module_get_current_playing_channels;
var mGetNumChannels = Module._openmpt_module_get_num_channels;
var mGetCurTempo = Module._openmpt_module_get_current_tempo;
var mGetCurSpeed = Module._openmpt_module_get_current_speed;
var mGetPosition = Module._openmpt_module_get_position_seconds;

// ensure that Chiptune2js player is initialized and is not paused or
// loading module data.
function playerAvailable() {
  if (typeof player === 'undefined') return false;
  if (typeof player.currentPlayingNode === 'undefined' || player.currentPlayingNode === null) return false;
  if (typeof player.currentPlayingNode.paused === 'undefined' || player.currentPlayingNode.paused === null) return false;
  if (player.currentPlayingNode.modulePtr === null) return false;
  return true;
}

function shouldBuild() {
  if (!playerAvailable()) return false;
  return !built;
}

function secondsToTimestamp(seconds) {
  var min = Math.floor(seconds / 60);
  var sec = Math.floor(seconds % 60);
  return padLeft(min, 2) + ":" + padLeft(sec, 2);
}

function padLeft(nr, n, str){
    return Array(n-String(nr).length+1).join(str||'0')+nr;
}


app.controller(
  "SongData",
  function($scope, $interval) {
    $scope.curPattern = '';
    $scope.numPatternRows = '';
    $scope.currentRow = '';
    $scope.channels = '';
    $scope.order = '';
    $scope.prow = '';
    $scope.tempo = '';
    $scope.speed = '';
    $scope.time = '';

    stopSongData = $interval(function(){
      if (!playerAvailable()) {
        clearPatternData();
        return;
      }

      $scope.curPattern = mGetOrderPattern(player.currentPlayingNode.modulePtr);
      $scope.numPatternRows = mGetNumPatternRows(player.currentPlayingNode.modulePtr, $scope.curPattern);
      $scope.currentRow = mGetCurRow(player.currentPlayingNode.modulePtr);
      $scope.channels = mGetActiveChannels(player.currentPlayingNode.modulePtr);
      $scope.order = mGetCurOrder(player.currentPlayingNode.modulePtr);
      $scope.prow = padLeft($scope.currentRow, 3) + " / " + padLeft($scope.numPatternRows, 3);
      $scope.tempo = mGetCurTempo(player.currentPlayingNode.modulePtr);
      $scope.speed = mGetCurSpeed(player.currentPlayingNode.modulePtr);
      $scope.time = secondsToTimestamp(mGetPosition(player.currentPlayingNode.modulePtr));
      $scope.duration = secondsToTimestamp(player.duration());
    }, 0);

    function clearPatternData() {
      $scope.curPattern = '';
      $scope.numPatternRows = '';
      $scope.currentRow = '';
      $scope.channels = '';
      $scope.order = '';
      $scope.prow = '';
      $scope.tempo = '';
      $scope.speed = '';
      $scope.time = '';
      $scope.duration = '';
    }
  }
)
.controller(
  "PatternData",
  function($scope, $interval) {
    var MID_ROW = 15;
    var VIS_ROWS = 32;
    var PIPE_SEP = " | ";
    var oldOrder = -1;
    var mData = null;
    $scope.currentRow = 0;
    $scope.numRows = -1;
    $scope.offset = MID_ROW;
    $scope.vis_rows = VIS_ROWS;

    stopPattern = $interval(function() {
      if (!playerAvailable()) return;
      if (shouldBuild()) {
        mData = buildModArray();
        built = true;
      }
      var curOrder = mGetCurOrder(player.currentPlayingNode.modulePtr);
      var curPattern = mGetOrderPattern(player.currentPlayingNode.modulePtr, curOrder);
      $scope.currentRow = mGetCurRow(player.currentPlayingNode.modulePtr);
      $scope.numRows = mGetNumPatternRows(player.currentPlayingNode.modulePtr, curPattern);
      $scope.pData = mData[curOrder];
    }, 0);

    function buildModArray() {
      var numChannels = mGetNumChannels(player.currentPlayingNode.modulePtr);
      var numOrders = mGetNumOrders(player.currentPlayingNode.modulePtr);
      var modData = new Array(numOrders);
      for (var order = 0; order < numOrders; order++) {
        pattern = mGetOrderPattern(player.currentPlayingNode.modulePtr, order);
        modData[order] = buildPattern(numChannels, pattern);
      }
      return modData;
    }

    function buildPattern(numChannels, pattern) {
      var numPatternRows = mGetNumPatternRows(player.currentPlayingNode.modulePtr, pattern);
      var minSize = (numPatternRows < VIS_ROWS) ? VIS_ROWS : numPatternRows;
      var pData = new Array(minSize);
      for (var rowNum = 0; rowNum < numPatternRows; rowNum++) {
        pData[rowNum] = buildRow(numChannels, pattern, rowNum);
      }
      return pData;
    }

    function buildRow(numChannels, pattern, row) {
      var rowData = new Array(numChannels+1);
      rowData[0] = padLeft(row, 3, '0') + PIPE_SEP;
      for (var ch = 0; ch < numChannels; ch++) {
        chData = mPtrToString(mFormatChannel(player.currentPlayingNode.modulePtr, pattern, row, ch));
        rowData[ch+1] = PIPE_SEP + chData + PIPE_SEP;
      }
      return rowData;
    }

    function padLeft(nr, n, str) {
      return Array(n-String(nr).length+1).join(str||'0')+nr;
	  };

    $scope.getChannelData = function(row, channel) {
      if (!playerAvailable()) return "";
      var maybe_blank = 0;
      // pattern rows >= 32
      maybe_blank = ($scope.currentRow - (MID_ROW - row));
      // pattern rows < 32
      if ($scope.numRows >= VIS_ROWS) {
        if (maybe_blank < 0 || maybe_blank >= $scope.numRows) return "";
      } else {
        if (maybe_blank < 0 || maybe_blank >= VIS_ROWS) return "";
      }
      return $scope.pData[maybe_blank][channel];
    };

    $scope.stopIntervals = function() {
      if (angular.isDefined(stopPattern)) {
        $interval.cancel(stopPattern);
        stopPattern = undefined;
      }
    };

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      $scope.stopIntervals();
    })
  })
  .controller(
    "SongMetaData",
    function($scope, $interval) {
      $scope.title = '';
      $scope.trackerType = '';
      $scope.releaseDate = '';

      stopSongMetaData = $interval(function() {
        if (!playerAvailable()) {
          clearMetaData();
          return;
        }
        if (typeof metadata === "undefined") {
          metadata = player.metadata();
        }

        $scope.title = metadata['title'];
        $scope.trackerType = metadata['tracker'];

        if (typeof modinfo !== "undefined") {
          $scope.releaseDate = modinfo['releasedate'];
          $scope.artistHandle = modinfo['artisthandle'];
          $scope.filename = modinfo['filename'];
          $scope.filesize = modinfo['filesize'];
          $scope.releaseDate = modinfo['releasedate'];
          $scope.tmaHits = modinfo['hits'];
        } else {
          clearQueriedMetadata();
          $scope.filename = fileName;
        }

      }, 100);

      function clearMetaData() {
        $scope.title = '';
        $scope.trackerType = '';
        $scope.releaseDate = '';
        fileName = '';
      }

      function clearQueriedMetadata() {
        $scope.releaseDate = '';
        $scope.artistHandle = '';
        $scope.filesize = '';
        $scope.releaseDate = '';
        $scope.tmaHits = '';
      }

      $scope.$on('$destroy', function() {
        // Make sure that the interval is destroyed too
        $scope.stopIntervals();
      })

      $scope.stopIntervals = function() {
        if (angular.isDefined(stopSongMetaData)) {
          $interval.cancel(stopSongMetaData);
          stopSongMetaData = undefined;
        }
      };
  }
);
