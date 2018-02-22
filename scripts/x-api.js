/** @namespace H5P */
H5P.VideoXAPI = (function ($) {

    var self = this;
    /**
   * Xapi video statement generator for H5P.
   *
   * @class
   */

        /**
        * Generate a random GUID string used for seesionID with video xAPI statements.
        */
        self.guid = function () {
          var s4 = function () {
           return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
          };
         return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };

        /**
         * Format parameter as float (or null if invalid).
         *
         * @param {string} number Number to convert to float
         * used when making arguments sent with video xAPI statments
         */
        self.formatFloat = function (number) {
          if (number == null) {
            return null;
          }
          return +(parseFloat(number).toFixed(2));
        };
        /**
         * Format time to ISO8601 time 
         *
         * @param {float} time Number to convert to ISO8601 string
         */
        self.time_to_iso8601_duration = function( time ) {
             var units = {
                "Y" : (365*24*3600),
                "D" :    (24*3600),
                "H" :       3600,
                "M" :          60,
                "S" :           1,
            }
            var time_names = [ "H", "M", "S" ];

            var str = "P";
            var istime = false;

            for(var unitName in units ) {
                if( units.hasOwnProperty(unitName)) {
                    var unit = units[unitName];
                    var quot  = parseInt( time / unit);
                    var time  = time - (quot * unit);
                    unit  = quot;
                    if (unit > 0) {
                        if (!istime && (time_names.indexOf(unitName) > -1) ) { // There may be a better way to do this
                            str += "T";
                            istime = true;
                        }
                        str += ''+unit+'' + unitName;
                    }
                }
            }

            return str;
        }

        /**
        * Track xAPI statement data for video events.
        * @private
        */
        self.previousTime = 0;
        self.seekStart = null;
        self.playedSegments = [];
        self.playedSegmentsSegmentStart =0;
        self.playedSegmentsSegmentEnd;
        self.volumeChangedOn = null;
        self.volumeChangedAt = 0;
        self.seeking = false;
        self.sessionID = this.guid();
        self.currentTime = 0;
        self.seekedTo = 0;
        self.duration = 0;

       /**
        * Calculate video progress.
        */
       self.getProgress = function (currentTime, duration) {
         var arr, arr2;
         self.endPlayedSegment(currentTime);
         self.playedSegmentsSegmentStart = currentTime;
         // Get played segments array.
         arr = self.playedSegments == "" ? [] : self.playedSegments.split("[,]");
         if (self.playedSegmentsSegmentStart != null) {
           arr.push(self.playedSegmentsSegmentStart + "[.]" + self.formatFloat(currentTime));
         }

         arr2 = [];
         arr.forEach(function (v,i) {
           arr2[i] = v.split("[.]");
           arr2[i][0] *= 1;
           arr2[i][1] *= 1;
         });

         // Sort the array.
         arr2.sort(function (a,b) {
           return a[0] - b[0];
         });

         // Normalize the segments.
         arr2.forEach(function (v,i) {
           if (i > 0) {
             // Overlapping segments: this segment's starting point is less than last segment's end point.
             if (arr2[i][0] < arr2[i-1][1]) {
               arr2[i][0] = arr2[i-1][1];
               if (arr2[i][0] > arr2[i][1]) {
                 arr2[i][1] = arr2[i][0];
               }
             }
           }
         });

         // Calculate progress length.
         var progressLength = 0;
         arr2.forEach(function (v,i) {
           if (v[1] > v[0]) {
             progressLength += v[1] - v[0];
           }
         });

         var progress = 1 * (progressLength / duration ).toFixed(2);

         return progress;
       };

        /**
         * Add a played segment to the array of already played segments.
         *
         * @param {int} endTime When the current played segment ended
         */
        self.endPlayedSegment = function (endTime) {
          var arr;
          // Need to not push in segments that happen from multiple triggers during scrubbing
          if (endTime !== self.playedSegmentsSegmentStart && Math.abs(endTime - self.playedSegmentsSegmentStart) > 1 ) {
            // Don't run if called too closely to each other.
            arr = self.playedSegments == "" ? [] : self.playedSegments.split("[,]");
            arr.push(self.formatFloat(self.playedSegmentsSegmentStart) + "[.]" + self.formatFloat(endTime));
            self.playedSegments = arr.join("[,]");
            self.playedSegmentsSegmentEnd = endTime;
            self.playedSegmentsSegmentStart = null;
          }
        };

        /**
         * self.getArgsXAPIPaused
         *
         * @param {type} currentTime
         * @returns {json object}
         */
        self.getArgsXAPIPaused = function (currentTime, duration) {
          var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          var resultExtTime = self.formatFloat(currentTime);
          self.endPlayedSegment(resultExtTime);
          self.playedSegmentsSegmentStart = resultExtTime;
          var progress = self.getProgress(currentTime, duration);
          var extensions = {};
          if ( typeof resultExtTime != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/time"] = resultExtTime
          }
          if ( typeof progress != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/progress"] = progress
          }
          if ( typeof self.playedSegments != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/played-segments"] = self.playedSegments
          }
          return {
            "verb": {
                "id": "https://w3id.org/xapi/video/verbs/paused",
                "display": {
                    "en-US": "paused"
                }
            },
            "result": {
              "extensions": extensions
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": {
                "https://w3id.org/xapi/video/extensions/session-id": self.sessionID
              }
            },
            "timestamp" : timeStamp
          };
        };

        /**
         * self.getArgsXAPIPlayed
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with event to be triggered by xAPI event
         */
        self.getArgsXAPIPlayed = function (currentTime) {
          var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          var resultExtTime = self.formatFloat(currentTime);
          self.playedSegmentsSegmentStart = resultExtTime;
          self.seekStart = null;

          return {
            "verb": {
                "id": "https://w3id.org/xapi/video/verbs/played",
                "display": {
                    "en-US": "played"
                }
            },
            "result": {
              "extensions": {
                "https://w3id.org/xapi/video/extensions/time": resultExtTime,
              }
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": {
                "https://w3id.org/xapi/video/extensions/session-id": self.sessionID
              }
            },
            "timestamp": timeStamp
          };
        };

         /**
         * self.getArgsXAPISeeked
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with seeked event to be triggered by xAPI event
         */
        self.getArgsXAPISeeked = function (currentTime) {
          var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          var resultExtTime = self.formatFloat(currentTime);
          self.seekStart = resultExtTime;
          self.endPlayedSegment(self.previousTime.toFixed(2));
          self.playedSegmentsSegmentStart = self.seekStart.toFixed(2);

          return {
            "verb": {
                "id": "https://w3id.org/xapi/video/verbs/seeked",
                "display": {
                    "en-US": "seeked"
                }
            },
            "result": {
              "extensions" : {
                "https://w3id.org/xapi/video/extensions/time-from": self.previousTime.toFixed(2),
                "https://w3id.org/xapi/video/extensions/time-to": self.seekStart.toFixed(2)
              }
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": {
                "https://w3id.org/xapi/video/extensions/session-id": self.sessionID
              }
            },
            "timestamp" : timeStamp
          };
        };

        /**
         * self.getArgsXAPIVolumeChanged
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with volume change event to be triggered by xAPI event
         */
        self.getArgsXAPIVolumeChanged = function (currentTime, muted, volume) {
         var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          self.volumeChangedAt = self.formatFloat(currentTime);
          var isMuted = muted;
          var volumeChange;
          if (isMuted === true) {
            volumeChange = 0;
          } else {
            volumeChange = self.formatFloat(volume);
          }

          return {
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/interacted",
                "display": {
                    "en-US": "interacted"
                }
            },
            "result" : {
              "extensions": {
                "https://w3id.org/xapi/video/extensions/time": self.volumeChangedAt
              }
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": {
                "https://w3id.org/xapi/video/extensions/session-id": self.sessionID,
                "https://w3id.org/xapi/video/extensions/volume": volumeChange
              }
            },
            "timestamp" : timeStamp
          };
        };

        /**
         * self.getArgsXAPICompleted
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with complete event to be triggered by xAPI event
         */
        self.getArgsXAPICompleted = function (currentTime, duration) {
          var progress = self.getProgress(currentTime, duration);
          var resultExtTime = self.formatFloat(currentTime);
          var dateTime = new Date();
          self.endPlayedSegment(resultExtTime);
          var timeStamp = dateTime.toISOString();
          //make sure extensions exist
          var extensions = {};
          if ( typeof resultExtTime != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/time"] = resultExtTime
          }
          if ( typeof progress != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/progress"] = progress
          }
          if ( typeof self.playedSegments != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/played-segments"] = self.playedSegments
          }

          return {
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/completed",
                "display": {
                    "en-US": "completed"
                }
            },
            "result": {
              "extensions": extensions,
              "success" : true,
              "duration" : self.time_to_iso8601_duration( duration )
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": {
                "https://w3id.org/xapi/video/extensions/session-id": self.sessionID
              }
            },
            "timestamp" : timeStamp
          };
        };

        /**
         * self.getArgsXAPIFullScreen
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with full screen change event to be triggered by xAPI event
         */
        self.getArgsXAPIFullScreen = function (currentTime, width, height, fullscreen = false) {
          var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          var resultExtTime = self.formatFloat(currentTime);
          var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || fullscreen;
          var screenSize = screen.width + "x" + screen.height;
          var playbackSize = width + "x" + height;
          //make sure extensions exist
          var extensions = {};
          if ( typeof self.sessionID != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/session-id"] = self.sessionID
          }
          if ( typeof state != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/full-screen"] = state
          }
          if ( typeof screenSize != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/screen-size"] = screenSize
          }
          if ( typeof playbackSize != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/video-playback-size"] = playbackSize
          }
          return {
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/interacted",
                "display": {
                    "en-US": "interacted"
                }
            },
            "result": {
              "extensions": {
                "https://w3id.org/xapi/video/extensions/time": resultExtTime
              }
            },
            "context": {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": extensions
            },
            "timestamp" : timeStamp
          };
        };

        /**
         * self.getArgsXAPIInitialized
         *
         * @param { float } currentTime time of the video currently
         *
         * used to retun json object sent with full screen change event to be triggered by xAPI event
         */
        self.getArgsXAPIInitialized = function (currentTime, width, height, rate, volume, ccEnabled, ccLanguage, quality) {
          // Set default value for quality.
          quality = typeof quality !== 'undefined' ? quality : Math.min(width, height);

          // Variables used in compiling xAPI results.
          var dateTime = new Date();
          var timeStamp = dateTime.toISOString();
          var resultExtTime = self.formatFloat(currentTime);
          var screenSize = screen.width + "x" + screen.height;
          var playbackSize = (width !== undefined && width !== '' ) ? width + "x" + height : "undetermined";
          var playbackRate = rate;
          var volume = self.formatFloat(volume);
          var userAgent = navigator.userAgent;
          var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || false;
          //make sure extensions exist
          var extensions = {};
          if ( typeof state != "undefined" && state != false){
              extensions["https://w3id.org/xapi/video/extensions/full-screen"] = state
          }
          if ( typeof screenSize != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/screen-size"] = screenSize
          }
          if ( typeof playbackSize != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/video-playback-size"] = playbackSize
          }
          if ( typeof self.sessionID != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/session-id"] = self.sessionID
          }
          if ( typeof quality != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/quality"] = quality
          }
          if ( typeof ccEnabled != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/cc-enabled"] = ccEnabled
          }
          if ( typeof playbackRate != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/speed"] = playbackRate
          }
          if ( typeof userAgent != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/user-agent"] = userAgent
          }
          if ( typeof volume != "undefined" ){
              extensions["https://w3id.org/xapi/video/extensions/volume"] = volume
          }
          return {
            "verb": {
                      "id": "http://adlnet.gov/expapi/verbs/initialized",
                      "display": {
                          "en-US": "initialized"
                      }
                  },
            "context" : {
              "contextActivities": {
                "category": [{
                  "id": "https://w3id.org/xapi/video"
                }]
              },
              "extensions": extensions
            },
            "timestamp": timeStamp
          };
        };


    return self;
})(H5P.jQuery );
