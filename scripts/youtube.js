/** @namespace H5P */
H5P.VideoYouTube = (function ($) {

  /**
   * YouTube video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function YouTube(sources, options, l10n) {
    var self = this;

    var player;
    var playbackRate = 1;
    var id = 'h5p-youtube-' + numInstances;
    numInstances++;
     /*
     * variables to track add extra xAPI statements for video
     * @type private
     */
    var previousTime = 0;
    var seekStart = null;
    var played_segments = [];
    var played_segments_segment_start;
    var played_segments_segment_end;
    var volume_changed_on = null;
    var volume_changed_at = 0;
    var seeking = false;
    var sessionID = guid();
    var currentTime = 0;

    var $wrapper = $('<div/>');
    var $placeholder = $('<div/>', {
      id: id,
      text: l10n.loading
    }).appendTo($wrapper);

    // Optional placeholder
    // var $placeholder = $('<iframe id="' + id + '" type="text/html" width="640" height="360" src="https://www.youtube.com/embed/' + getId(sources[0].path) + '?enablejsapi=1&origin=' + encodeURIComponent(ORIGIN) + '&autoplay=' + (options.autoplay ? 1 : 0) + '&controls=' + (options.controls ? 1 : 0) + '&disabledkb=' + (options.controls ? 0 : 1) + '&fs=0&loop=' + (options.loop ? 1 : 0) + '&rel=0&showinfo=0&iv_load_policy=3" frameborder="0"></iframe>').appendTo($wrapper);

    /**
     * Use the YouTube API to create a new player
     *
     * @private
     */
    var create = function () {
      if (!$placeholder.is(':visible') || player !== undefined) {
        return;
      }

      if (window.YT === undefined) {
        // Load API first
        loadAPI(create);
        return;
      }
      if (YT.Player === undefined) {
        return;
      }

      var width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      var loadCaptionsModule = true;

      var videoId = getId(sources[0].path);

      player = new YT.Player(id, {
        width: width,
        height: width * (9/16),
        videoId: videoId,
        playerVars: {
          origin: ORIGIN,
          autoplay: options.autoplay ? 1 : 0,
          controls: options.controls ? 1 : 0,
          disablekb: options.controls ? 0 : 1,
          fs: 0,
          loop: options.loop ? 1 : 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          wmode: "opaque",
          start: options.startAt,
          playsinline: 1,
          playlist: videoId // Setting the playlist so that looping works
        },
        events: {
          onReady: function () {
            self.trigger('ready');
            self.trigger('loaded');
            self.trigger('xAPIloaded',getLoadedParams());
          },
          onApiChange: function () {
            if (loadCaptionsModule) {
              loadCaptionsModule = false;

              // Always load captions
              player.loadModule('captions');
            }

            var trackList;
            try {
              // Grab tracklist from player
              trackList = player.getOption('captions', 'tracklist');
            }
            catch (err) {}
            if (trackList && trackList.length) {

              // Format track list into valid track options
              var trackOptions = [];
              for (var i = 0; i < trackList.length; i++) {
                trackOptions.push(new H5P.Video.LabelValue(trackList[i].displayName, trackList[i].languageCode));
              }

              // Captions are ready for loading
              self.trigger('captions', trackOptions);
            }
          },
          onStateChange: function (state) {
            if (state.data > -1 && state.data < 4) {

              // Fix for keeping playback rate in IE11
              if (H5P.Video.IE11_PLAYBACK_RATE_FIX && state.data === H5P.Video.PLAYING && playbackRate !== 1) {
                // YT doesn't know that IE11 changed the rate so it must be reset before it's set to the correct value
                player.setPlaybackRate(1);
                player.setPlaybackRate(playbackRate);
              }
              // End IE11 fix

              self.trigger('stateChange', state.data);
              
              //calls for xAPI events
              if ( state.data == 1 ){
                  
                  if ( (Math.abs( previousTime - player.getCurrentTime() ) > 1) || seeking ){
                      //call from a seek we run seek command not play
                      self.trigger('seeked', getSeekParams());
                      seeking = false;
                  } else {
                     //get and send play call
                     self.trigger('play', getPlayParams());
                  }
              }
              if ( state.data == 2 ) {
                //this is a paused event
                 // execute your code here for paused state
                   self.trigger('paused', getPausedParams());
              } else if ( state.data == 0 ) {
                  //send xapi trigger if video progress indicates completed
                  var length = player.getDuration();
                  if ( length > 0){
                      var progress = get_progress();
                      var resultExtTime = formatFloat(player.getCurrentTime());
                      if ( progress >= 1 ){
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
                  }
              }
            }
          },
          onPlaybackQualityChange: function (quality) {
            self.trigger('qualityChange', quality.data);
          },
          onPlaybackRateChange: function (playbackRate) {
            self.trigger('playbackRateChange', playbackRate.data);
          },
          onError: function (error) {
            var message;
            switch (error.data) {
              case 2:
                message = l10n.invalidYtId;
                break;

              case 100:
                message = l10n.unknownYtId;
                break;

              case 101:
              case 150:
                message = l10n.restrictedYt;
                break;

              default:
                message = l10n.unknownError + ' ' + error.data;
                break;
            }
            self.trigger('error', message);
          }
        }
      });
    };
    
    //Youtube player has no timeupdate event so need to use setInterval
    setInterval(function(){ 
        if( typeof player !== undefined ){
            previousTime = currentTime;
            currentTime = formatFloat(player.getCurrentTime());
            if( Math.abs(previousTime - currentTime) > 1){
                seeking = true;
            }
        }
    }, 1000);
    //function used when putting together object to send for xAPI calls
    function getWidthOrHeight ( returnType ){
        var quality = player.getPlaybackQuality();
        var width;
        var height;
        switch (quality) {
            case 'small':
                width: '320';
                height: '240';
                break;
            case 'medium':
                width: '640';
                height: '360';
                break;
            case 'large':
                width: '853';
                height: '480';
                break;
            case 'hd720':
                width: '640';
                height: '360';
                break;
            case 'hd1080':
                width: '1920';
                height: '1080';
                break;
            case 'highres':
                width: '1920';
                height: '1080';
                break;
        }
        
        return (returnType.toLowerCase().trim()=='width')? width : height;
    }
    
    function getLoadedParams(){
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(player.getCurrentTime());
        var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
        var screenSize = screen.width + "x" + screen.height;
        var quality = player.getPlaybackQuality();
        var height = getWidthOrHeight('height');
        var width = getWidthOrHeight('width');
        var playbackSize = ( width !== undefined )? width + 'x' + height : "undetermined";
        var volume = player.getVolume();
        var ccEnabled = ( player.getOptions().indexOf("cc") !== -1) ? true : false;
        var ccLanguage;
        if ( ccEnabled ) {
            ccLanguage = player.getOptions('cc', 'track').languageCode;
        }
        var userAgent = navigator.userAgent;
        var playbackRate = player.getPlaybackRate();
        
        var arg = {
                "context" : {
                    "contextActivities": {
	                    "category": [
	                       {
	                          "id": "https://w3id.org/xapi/video"
	                       }
	                    ]
                    },
                    "extensions": {
	                        "https://w3id.org/xapi/video/extensions/full-screen": state,
	                        "https://w3id.org/xapi/video/extensions/screen-size": screenSize,
	                        "https://w3id.org/xapi/video/extensions/video-playback-size": playbackSize,
	                        "https://w3id.org/xapi/video/extensions/quality": quality,
	                        "https://w3id.org/xapi/video/extensions/cc-enabled": ccEnabled,
	                        "https://w3id.org/xapi/video/extensions/cc-subtitle-lang": ccLanguage,
	                        "https://w3id.org/xapi/video/extensions/speed": playbackRate + "x",
	                        "https://w3id.org/xapi/video/extensions/user-agent": userAgent,
	                        "https://w3id.org/xapi/video/extensions/volume": volume,
                                "https://w3id.org/xapi/video/extensions/session-id": sessionID
                    }
                },
                "timestamp": timeStamp
            };
        return arg;
    }
    function getPlayParams(){
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(player.getCurrentTime());
        played_segments_segment_start = resultExtTime;
        seekStart = null;
        played_segments_segment_start = resultExtTime;
        var arg = {
                "result": {
    	                "extensions": {
    	                    "https://w3id.org/xapi/video/extensions/time": resultExtTime,
    	                }
                },
                "context": {
                    "contextActivities": {
                        "category": [
                           {
                              "id": "https://w3id.org/xapi/video"
                           }
                        ]
                    },
                    "extensions": {
                            "https://w3id.org/xapi/video/extensions/session-id": sessionID

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
        var resultExtTime = formatFloat(player.getCurrentTime());
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
                "context": {
                    "contextActivities": {
                        "category": [
                           {
                              "id": "https://w3id.org/xapi/video"
                           }
                        ]
                    },
                    "extensions": {
                            "https://w3id.org/xapi/video/extensions/session-id": sessionID

                    }
                },
                "timestamp" : timeStamp
            };
            return arg;
    }
    function getSeekParams() {
        var dateTime = new Date();
        var timeStamp = dateTime.toISOString();
        var resultExtTime = formatFloat(player.getCurrentTime());
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
            "context": {
                "contextActivities": {
                    "category": [
                       {
                          "id": "https://w3id.org/xapi/video"
                       }
                    ]
                },
                "extensions": {
                        "https://w3id.org/xapi/video/extensions/session-id": sessionID

                }
            },
            "timestamp" : timeStamp
        }
        
        return arg;
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
                        arr.push(played_segments_segment_start + "[.]" + formatFloat(player.getCurrentTime()));
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

                var progress = 1 * (progress_length / player.getDuration()).toFixed(2);
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
    function guid() {
        function s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
          s4() + '-' + s4() + s4() + s4();
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
    /**
     * Indicates if the video must be clicked for it to start playing.
     * For instance YouTube videos on iPad must be pressed to start playing.
     *
     * @public
     */
    self.pressToPlay = navigator.userAgent.match(/iPad/i) ? true : false;

    /**
    * Appends the video player to the DOM.
    *
    * @public
    * @param {jQuery} $container
    */
    self.appendTo = function ($container) {
      $container.addClass('h5p-youtube').append($wrapper);
      create();
    };

    /**
     * Get list of available qualities. Not available until after play.
     *
     * @public
     * @returns {Array}
     */
    self.getQualities = function () {
      if (!player || !player.getAvailableQualityLevels) {
        return;
      }

      var qualities = player.getAvailableQualityLevels();
      if (!qualities.length) {
        return; // No qualities
      }

      // Add labels
      for (var i = 0; i < qualities.length; i++) {
        var quality = qualities[i];
        var label = (LABELS[quality] !== undefined ? LABELS[quality] : 'Unknown'); // TODO: l10n
        qualities[i] = {
          name: quality,
          label: LABELS[quality]
        };
      }

      return qualities;
    };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () {
      if (!player || !player.getPlaybackQuality) {
        return;
      }

      var quality = player.getPlaybackQuality();
      return quality === 'unknown' ? undefined : quality;
    };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) {
      if (!player || !player.setPlaybackQuality) {
        return;
      }

      player.setPlaybackQuality(quality);
    };

    /**
     * Start the video.
     *
     * @public
     */
    self.play = function () {
      if (!player || !player.playVideo) {
        self.on('ready', self.play);
        return;
      }

      player.playVideo();
    };

    /**
     * Pause the video.
     *
     * @public
     */
    self.pause = function () {
      self.off('ready', self.play);
      if (!player || !player.pauseVideo) {
        return;
      }
      player.pauseVideo();
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    self.seek = function (time) {
      if (!player || !player.seekTo) {
        return;
      }

      player.seekTo(time, true);
    };

    /**
     * Get elapsed time since video beginning.
     *
     * @public
     * @returns {Number}
     */
    self.getCurrentTime = function () {
      if (!player || !player.getCurrentTime) {
        return;
      }

      return player.getCurrentTime();
    };

    /**
     * Get total video duration time.
     *
     * @public
     * @returns {Number}
     */
    self.getDuration = function () {
      if (!player || !player.getDuration) {
        return;
      }

      return player.getDuration();
    };

    /**
     * Get percentage of video that is buffered.
     *
     * @public
     * @returns {Number} Between 0 and 100
     */
    self.getBuffered = function () {
      if (!player || !player.getVideoLoadedFraction) {
        return;
      }

      return player.getVideoLoadedFraction() * 100;
    };

    /**
     * Turn off video sound.
     *
     * @public
     */
    self.mute = function () {
      if (!player || !player.mute) {
        return;
      }

      player.mute();
    };

    /**
     * Turn on video sound.
     *
     * @public
     */
    self.unMute = function () {
      if (!player || !player.unMute) {
        return;
      }

      player.unMute();
    };

    /**
     * Check if video sound is turned on or off.
     *
     * @public
     * @returns {Boolean}
     */
    self.isMuted = function () {
      if (!player || !player.isMuted) {
        return;
      }

      return player.isMuted();
    };

    /**
     * Return the video sound level.
     *
     * @public
     * @returns {Number} Between 0 and 100.
     */
    self.getVolume = function () {
      if (!player || !player.getVolume) {
        return;
      }

      return player.getVolume();
    };

    /**
     * Set video sound level.
     *
     * @public
     * @param {Number} level Between 0 and 100.
     */
    self.setVolume = function (level) {
      if (!player || !player.setVolume) {
        return;
      }

      player.setVolume(level);
    };

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} available playback rates
     */
    self.getPlaybackRates = function () {
      if (!player || !player.getAvailablePlaybackRates) {
        return;
      }

      var playbackRates = player.getAvailablePlaybackRates();
      if (!playbackRates.length) {
        return; // No rates, but the array should contain at least 1
      }

      return playbackRates;
    };

    /**
     * Get current playback rate.
     *
     * @public
     * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
     */
    self.getPlaybackRate = function () {
      if (!player || !player.getPlaybackRate) {
        return;
      }

      var playbackRate = player.getPlaybackRate();
	  return playbackRate;
    };

    /**
     * Set current playback rate.
     * Listen to event "playbackRateChange" to check if successful.
     *
     * @public
     * @params {Number} suggested rate that may be rounded to supported values
     */
    self.setPlaybackRate = function (newPlaybackRate) {
      if (!player || !player.setPlaybackRate) {
        return;
      }

      playbackRate = newPlaybackRate;
      player.setPlaybackRate(newPlaybackRate);
    };

    /**
     * Set current captions track.
     *
     * @param {H5P.Video.LabelValue} Captions track to show during playback
     */
    self.setCaptionsTrack = function (track) {
      player.setOption('captions', 'track', track ? {languageCode: track.value} : {});
    };

    /**
     * Figure out which captions track is currently used.
     *
     * @return {H5P.Video.LabelValue} Captions track
     */
    self.getCaptionsTrack = function () {
      var track = player.getOption('captions', 'track');
      return (track.languageCode ? new H5P.Video.LabelValue(track.displayName, track.languageCode) : null);
    };

    // Respond to resize events by setting the YT player size.
    self.on('resize', function () {
      if (!$wrapper.is(':visible')) {
        return;
      }

      if (!player) {
        // Player isn't created yet. Try again.
        create();
        return;
      }

      // Use as much space as possible
      $wrapper.css({
        width: '100%',
        height: '100%'
      });

      var width = $wrapper[0].clientWidth;
      var height = options.fit ? $wrapper[0].clientHeight : (width * (9/16));

      // Set size
      $wrapper.css({
        width: width + 'px',
        height: height + 'px'
      });

      player.setSize(width, height);
    });
  }

  /**
   * Check to see if we can play any of the given sources.
   *
   * @public
   * @static
   * @param {Array} sources
   * @returns {Boolean}
   */
  YouTube.canPlay = function (sources) {
    return getId(sources[0].path);
  };

  /**
   * Find id of YouTube video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} YouTube video identifier
   */

  var getId = function (url) {
    // Has some false positives, but should cover all regular URLs that people can find
    var matches = url.match(/(?:(?:youtube.com\/(?:attribution_link\?(?:\S+))?(?:v\/|embed\/|watch\/|(?:user\/(?:\S+)\/)?watch(?:\S+)v\=))|(?:youtu.be\/|y2u.be\/))([A-Za-z0-9_-]{11})/i);
    if (matches && matches[1]) {
      return matches[1];
    }
  };

  /**
   * Load the IFrame Player API asynchronously.
   */
  var loadAPI = function (loaded) {
    if (window.onYouTubeIframeAPIReady !== undefined) {
      // Someone else is loading, hook in
      var original = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function (id) {
        loaded(id);
        original(id);
      };
    }
    else {
      // Load the API our self
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = loaded;
    }
  };

  /** @constant {Object} */
  var LABELS = {
    highres: '2160p',
    hd1440: '1440p',
    hd1080: '1080p',
    hd720: '720p',
    large: '480p',
    medium: '360p',
    small: '240p',
    tiny: '144p',
    auto: 'Auto'
  };

  /** @private */
  var numInstances = 0;

  // Extract the current origin (used for security)
  var ORIGIN = window.location.href.match(/http[s]?:\/\/[^\/]+/)[0];

  return YouTube;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoYouTube);
