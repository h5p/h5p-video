/** @namespace H5P */
H5P.Video = (function ($, ContentCopyrights, MediaCopyright, handlers) {

  /**
   * The ultimate H5P video player!
   *
   * @class
   * @param {Object} parameters Options for this library.
   * @param {Object} parameters.visuals Visual options
   * @param {Object} parameters.playback Playback options
   * @param {Object} parameters.a11y Accessibility options
   * @param {Boolean} [parameters.startAt] Start time of video
   * @param {Number} id Content identifier
   */
  function Video(parameters, id) {
    var self = this;

    // Ref youtube.js - ipad & youtube - issue
    self.pressToPlay = false;

    // Initialize event inheritance
    H5P.EventDispatcher.call(self);

    // Default language localization
    parameters = $.extend(true, parameters, {
      l10n: {
        name: 'Video',
        loading: 'Video player loading...',
        noPlayers: 'Found no video players that supports the given video format.',
        noSources: 'Video is missing sources.',
        aborted: 'Media playback has been aborted.',
        networkFailure: 'Network failure.',
        cannotDecode: 'Unable to decode media.',
        formatNotSupported: 'Video format not supported.',
        mediaEncrypted: 'Media encrypted.',
        unknownError: 'Unknown error.',
        invalidYtId: 'Invalid YouTube ID.',
        unknownYtId: 'Unable to find video with the given YouTube ID.',
        restrictedYt: 'The owner of this video does not allow it to be embedded.'
      }
    });

    parameters.a11y = parameters.a11y || [];
    parameters.playback = parameters.playback || {};
    parameters.visuals = parameters.visuals || {};

    /** @private */
    var sources = [];
    if (parameters.sources) {
      for (var i = 0; i < parameters.sources.length; i++) {
        // Clone to avoid changing of parameters.
        var source = $.extend(true, {}, parameters.sources[i]);

        // Create working URL without html entities.
        source.path = H5P.getPath($cleaner.html(source.path).text(), id);
        sources.push(source);
      }
    }

    /** @private */
    var tracks = [];
    parameters.a11y.forEach(function (track) {
      // Clone to avoid changing of parameters.
      var clone = $.extend(true, {}, track);

      // Create working URL without html entities
      if (clone.track && clone.track.path) {
        clone.track.path = H5P.getPath($cleaner.html(clone.track.path).text(), id);
        tracks.push(clone);
      }
    });

    /**
     * Attaches the video handler to the given container.
     * Inserts text if no handler is found.
     *
     * @public
     * @param {jQuery} $container
     */
    self.attach = function ($container) {
      $container.addClass('h5p-video').html('');

      if (self.appendTo !== undefined) {
        self.appendTo($container);
      }
      else {
        if (sources.length) {
          $container.text(parameters.l10n.noPlayers);
        }
        else {
          $container.text(parameters.l10n.noSources);
        }
      }
    };

    /**
     * Gather copyright information for the current video.
     *
     * @public
     * @returns {ContentCopyrights}
     */
    self.getCopyrights = function () {
      if (!sources[0] || !sources[0].copyright) {
        return;
      }

      // Use copyright information from H5P media field
      var info = new ContentCopyrights();
      info.addMedia(new MediaCopyright(sources[0].copyright));

      return info;
    };

    // Resize the video when we know its aspect ratio
    self.on('loaded', function () {
      self.trigger('resize');
    });

    // Find player for video sources
    if (sources.length) {
      for (var i = 0; i < handlers.length; i++) {
        var handler = handlers[i];
        if (handler.canPlay !== undefined && handler.canPlay(sources)) {
          handler.call(self, sources, {
            controls: parameters.visuals.controls,
            autoplay: parameters.playback.autoplay,
            loop: parameters.playback.loop,
            fit: parameters.visuals.fit,
            poster: parameters.visuals.poster === undefined ? undefined : H5P.getPath(parameters.visuals.poster.path, id),
            startAt: parameters.startAt || 0,
            tracks: tracks
          }, parameters.l10n);
          return;
        }
      }
    }
    
      
  //xapi video profile setup and calls for video.js
   /*
     * variables to track add extra xAPI statements for video
     * @type private
     */
    var previousTime = null;
    var seekStart = null;
    var dateTime;
    var timeStamp;
    var played_segments = [];
    var played_segments_segment_start;
    var played_segments_segment_end;
    var volume_changed_on = null;
    var volume_changed_at = 0;
    var seeking = false;
    var lastState;
    var start = false;
    var tracks = Video.textTracks();
    var skipPlayEvent = false;
    var currentTime = 0;
    var next_completion_check = 0;
    var sent_completed = false;
    
    
    function getLoadedParams(){
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(Video.currentTime());
        var state = Video.isFullscreen(); 
        var screenSize = screen.width + "x" + screen.height;
        var quality = (Video.videoHeight() < Video.videoWidth())? Video.videoHeight():videoWidth();
        var height = Video.currentHeight();
        var width = Video.currentWidth();
        var playbackSize = ( width !== undefined )? width + 'x' + height : "undetermined";
        var volume = formatFloat(video.volume());
        var ccEnabled = false;
        var ccLanguage = "None Set";
        
        //Captions/Subtitles values
        for (var i = 0; i < tracks.length; i++) {
          var track = tracks[i];

          // If it is showing then CC is enabled and determine the language
          if (track.mode === 'showing') {
              ccEnabled = true;
              ccLanguage = track.language;
          }
        }
        var userAgent = navigator.userAgent;
        var playbackRate = Video.playbackRate();
        
        var arg = {
                "result" : {
                    "extensions": {
	                        "https://w3id.org/xapi/video/extensions/full-screen": state,
	                        "https://w3id.org/xapi/video/extensions/screen-size": screenSize,
	                        "https://w3id.org/xapi/video/extensions/video-playback-size": playbackSize,
	                        "https://w3id.org/xapi/video/extensions/quality": quality,
	                        "https://w3id.org/xapi/video/extensions/cc-enabled": ccEnabled,
	                        "https://w3id.org/xapi/video/extensions/cc-subtitle-lang": ccLanguage,
	                        "https://w3id.org/xapi/video/extensions/speed": playbackRate + "x",
	                        "https://w3id.org/xapi/video/extensions/user-agent": userAgent,
	                        "https://w3id.org/xapi/video/extensions/volume": volume

                    }
                },
                "timestamp": timeStamp
            };
        return arg;
    }
    function getPlayParams(){
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(Video.currentTime());
        played_segments_segment_start = resultExtTime;
        seekStart = null;
        played_segments_segment_start = resultExtTime;
        var arg = {
                "result": {
    	                "extensions": {
    	                    "https://w3id.org/xapi/video/extensions/time": resultExtTime,
    	                }
                },
                "timestamp": timeStamp
            };
        return arg;
    }
    //paused Params called on pause statement used by xAPI event
    function getPausedParams() {
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(Video.currentTime());
        previousTime = resultExtTime;
        end_played_segment(resultExtTime);
        var progress = get_progress();
        var arg = {
                "result": {
                    "extensions": {
                        "https://w3id.org/xapi/video/extensions/time": resultExtTime,
                        "https://w3id.org/xapi/video/extensions/progress": progress,
                        "https://w3id.org/xapi/video/extensions/played-segments": played_segments
                    }
                },
                "timestamp" : timeStamp
            };
            return arg;
    }
    function getSeekParams() {
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(Video.currentTime());
        seekStart = resultExtTime;
        end_played_segment(previousTime);
        played_segments_segment_start = seekStart;
        //put together data for xAPI statement to be sent with event
         var arg = {
            "result": {
                "extensions" : {
                    "https://w3id.org/xapi/video/extensions/time-from": previousTime,
                    "https://w3id.org/xapi/video/extensions/time-to": seekStart
                }
            },
            "timestamp" : timeStamp
        }
        
        return arg;
    }
    
    function check_completion() {
        if(sent_completed)
        {
                //console.log("completed statement already sent");
                return;
        }

        var currentTimestamp = (new Date()).getTime();

        if(currentTimestamp < next_completion_check) {
                //console.log(new Date(next_completion_check) + " in " + (next_completion_check - currentTimestamp)/1000 + " seconds");
                return;
        }
        var length = Video.duration();
        //console.log("length: " + length);
        if(length <= 0)
                return;

        var progress = get_progress();
        if(progress >= 1) {
                sent_completed = true;
                var resultExtTime = formatFloat(Video.currentTime());
                var arg = {
                    "result": {
                        "extensions": {
                            "https://w3id.org/xapi/video/extensions/time": resultExtTime,
                        "https://w3id.org/xapi/video/extensions/progress": progress
                        }
                    },
                    "timestamp" : timeStamp
                };
                self.trigger('completed',arg);
        }
        var remaining_seconds = (1 - progress) * length;
        //console.log("remaining_seconds: " + remaining_seconds);
        next_completion_check = currentTimestamp + remaining_seconds.toFixed(3) * 1000;
        //console.log("Progress: " + progress + " currentTimestamp: " + currentTimestamp + " next completion check in " + (next_completion_check - currentTimestamp)/1000 + " seconds");
    }
    function getVolumeChangeParams() {
            volume_changed_at = Video.currentTime();
            var isMuted = Video.muted();
            var volumeChange;
            if ( isMuted === true ){
                volumeChange = 0;
            } else {
                volumeChange = formatFloat(Video.volume());
            }
            var arg = {
                "result" : {
                    "extensions": {
                        "https://w3id.org/xapi/video/extensions/time": volume_changed_at,
                        "https://w3id.org/xapi/video/extensions/volume": volumeChange
                    }
                },
                "timestamp" : timeStamp
            };
            return arg;
    }
    function getFullScreenParams() {
        var state = Video.isFullscreen();
        var resultExtTime = formatFloat(Video.currentTime());
        
        //sed xapi statement
        var screenSize = screen.width + "x" + screen.height;

        //playback size
        var playbackSize = Video.currentWidth() + "x" + Video.currentHeight();

        arg = {
            "result": {
                "extensions": {
                    "https://w3id.org/xapi/video/extensions/time": resultExtTime,
                    "https://w3id.org/xapi/video/extensions/full-screen": state,
                    "https://w3id.org/xapi/video/extensions/screen-size": screenSize,
                    "https://w3id.org/xapi/video/extensions/video-playback-size": playbackSize
                }
            },
            "timestamp" : timeStamp
        };
    }
    // common math functions
    function formatFloat(number) {
        if(number == null)
            return null;

        return +(parseFloat(number).toFixed(3));
    }
    //determine video progress
    function get_progress() {
        var arr, arr2;

        //get played segments array
        arr = (played_segments == "")? []:played_segments.split("[,]");
                if(played_segments_segment_start != null){
                        arr.push(played_segments_segment_start + "[.]" + formatFloat(Video.currentTime()));
                }

                arr2 = [];
                arr.forEach(function(v,i) {
                        arr2[i] = v.split("[.]");
                        arr2[i][0] *= 1;
                        arr2[i][1] *= 1;
                });

                //sort the array
                arr2.sort(function(a,b) { return a[0] - b[0];});

                //normalize the segments
                arr2.forEach(function(v,i) {
                        if(i > 0) {
                                if(arr2[i][0] < arr2[i-1][1]) { 	//overlapping segments: this segment's starting point is less than last segment's end point.
                                        //console.log(arr2[i][0] + " < " + arr2[i-1][1] + " : " + arr2[i][0] +" = " +arr2[i-1][1] );
                                        arr2[i][0] = arr2[i-1][1];
                                        if(arr2[i][0] > arr2[i][1])
                                                arr2[i][1] = arr2[i][0];
                                }
                        }
                });

                //calculate progress_length
                var progress_length = 0;
                arr2.forEach(function(v,i) {
                        if(v[1] > v[0])
                        progress_length += v[1] - v[0]; 
                });

                var progress = 1 * (progress_length / Video.duration()).toFixed(2);
                return progress;
    }
    function end_played_segment(end_time) {
        var arr;
        arr = (played_segments == "")? []:played_segments.split("[,]");
        arr.push(played_segments_segment_start + "[.]" + end_time);
        played_segments = arr.join("[,]");
        played_segments_segment_end = end_time;
        played_segments_segment_start = null;
    } 
    ////////xAPI extension events for video/////
    //catch for seeked event
    self.on('seeked', function(event) {
        var statement = event.data;
        this.triggerXAPI('seeked', statement);
    });
    //catch volumeChanged Event
    self.on('volumechange', function(event) {
        var statement = event.data;
        this.triggerXAPI('interacted', statement);
    });
    self.on('completed', function(event){
        var statement = event.data;
        this.triggerXAPI('completed', statement);
    })
    //catch fullscreen Event
    self.on('fullscreen', function(event) {
        var statement = event.data;
        this.triggerXAPI('interacted', statement);
    });
    //catch play Event
    self.on('play', function(event) {
        var statement = event.data;
        this.triggerXAPI('played', statement);
    });
    self.on('xAPIloaded', function(event){
        var statement = event.data;
        this.triggerXAPI('initialized',statement);
    });
    //catch play Event
    self.on('paused', function(event) {
        var statement = event.data;
        this.triggerXAPI('paused', statement);
    });
    
    //event listeners
    Video.on('play', function() {
         if(start == false){
             start = true;
             self.trigger('xAPIloaded',getLoadedParams());
         } 
         
         if (skipPlayEvent !== true) {
             self.trigger('play',getPlayParams());
         } else {
             skipPlayEvent = false;
             self.trigger('seeked',getSeekParams());
         }
    });
    
    Video.on('pause', function() {
        if (this.seeking() === false ){
            self.trigger('paused', getPausedParams());
        } else {
            skipPlayEvent = true;
        }
    });
    Video.on("timeupdate", function() {
        previousTime = currentTime;
        currentTime = formatFloat(Video.currentTime());
        check_completion();
    });
    Video.on("volumechange",function() {		
        self.trigger('volumechange',getVolumeChangeParams());
    });
    Video.on("fullscreenchange",function(){
        self.trigger('fullscreen',getFullScreenParams());
    });
    
  }

  // Extends the event dispatcher
  Video.prototype = Object.create(H5P.EventDispatcher.prototype);
  Video.prototype.constructor = Video;

  // Player states
  /** @constant {Number} */
  Video.ENDED = 0;
  /** @constant {Number} */
  Video.PLAYING = 1;
  /** @constant {Number} */
  Video.PAUSED = 2;
  /** @constant {Number} */
  Video.BUFFERING = 3;
  /**
   * When video is queued to start
   * @constant {Number}
   */
  Video.VIDEO_CUED = 5;

  // Used to convert between html and text, since URLs have html entities.
  var $cleaner = H5P.jQuery('<div/>');

  /**
   * Help keep track of key value pairs used by the UI.
   *
   * @class
   * @param {string} label
   * @param {string} value
   */
  Video.LabelValue = function (label, value) {
    this.label = label;
    this.value = value;
  };

  /** @constant {Boolean} */
  Video.IE11_PLAYBACK_RATE_FIX = (navigator.userAgent.match(/Trident.*rv[ :]*11\./) ? true : false);

  return Video;
})(H5P.jQuery, H5P.ContentCopyrights, H5P.MediaCopyright, H5P.videoHandlers || []);
