var H5P = H5P || {};

/**
 * Constructor.
 *
 * @param {Object} params Options for this library.
 * @param {Number} id Content identifier
 * @returns {undefined}
 */
H5P.Video = function (params, id) {
  this.$ = H5P.jQuery(this);
  this.params = params;
  this.contentId = id;
  
  // Use new copyright information if available. Fallback to old.
  if (params.files !== undefined
      && params.files[0] !== undefined
      && params.files[0].copyright !== undefined) {
      
    this.copyright = params.files[0].copyright;
  }
  else if (params.copyright !== undefined) {
    this.copyright = params.copyright;
  }
};

// For android specific stuff.
H5P.Video.android = (navigator.userAgent.indexOf('Android') !== -1);

// For chrome specific stuff.
H5P.Video.chrome = (navigator.userAgent.indexOf('Chrome') !== -1);

/**
 * Wipe out the content of the wrapper and put our HTML in it.
 *
 * @param {jQuery} $wrapper Our poor container.
 */
H5P.Video.prototype.attach = function ($wrapper) {
  var that = this;

  // Check if browser supports video.
  var video = document.createElement('video');
  if (video.canPlayType === undefined) {
    // Try flash
    this.attachFlash($wrapper);
    return;
  }

  // Find supported sources.
  if (this.params.files !== undefined && this.params.files instanceof Object) {
    this.qualities = []; // Sort sources by quality.
  
    for (var i = 0; i < this.params.files.length; i++) {
      var file = this.params.files[i];
      
      var type = file.mime;
      if (file.codecs !== undefined)  {
        type += '; codecs="' + file.codecs + '"'; 
      }

      // Check if we can play this source.
      if (video.canPlayType(type) !== '') { 
        if (file.quality === undefined) {
          // Add default quality if source has none.
          file.quality = {
            level: 0,
            label: 'Default'
          };
        }
        
        var source = H5P.getPath(file.path, this.contentId);
        if (this.qualities[file.quality.level] === undefined) {
          // Add new source.
          this.qualities[file.quality.level] = { 
            label: file.quality.label,
            source: source
          };
        }
        else {
          // Replace source if we have a better.
          // Prefer mp4, but webm for Chrome due to trouble with some mp4 codecs.
          var preferred = (H5P.Video.chrome ? 'webm' : 'mp4')
          if (file.mime.split('/')[1] === preferred) {
            this.qualities[file.quality.level].source = source;
          }
        }
      }
    }
    
    // Get preferred quality level through cookie.
    video.src = this.getPreferredQuality();
  }

  if (video.src === '') {
    // Found no source. Try flash.
    this.attachFlash($wrapper);
    return;
  }

  if (this.endedCallback !== undefined) {
    video.addEventListener('ended', this.endedCallback, false);
  }

  // Fire callback when loaded
  if (this.loadedCallback !== undefined) {
    if (H5P.Video.android) {
      var play = function () {
        video.removeEventListener('play', play ,false);
        var loaded = function () {
          // On Android duration isn't available until after play.
          video.removeEventListener('durationchange', loaded, false);
          that.loadedCallback();
        }
        video.addEventListener('durationchange', loaded, false);
      };
      video.addEventListener('play', play, false);
    }
    else {
      var loaded = function () {
        video.removeEventListener('loadedmetadata', loaded, false);
        that.loadedCallback();
      }
      video.addEventListener('loadedmetadata', loaded, false);
    }
  }

  if (this.errorCallback !== undefined) {
    video.addEventListener('error', this.errorCallback, false);
  }

  video.className = 'h5p-video';
  video.controls = this.params.controls === undefined ? true : this.params.controls;
  video.autoplay = this.params.autoplay === undefined ? false : this.params.autoplay;
  video.style.display = 'block';

  if (this.params.fitToWrapper === undefined || this.params.fitToWrapper) {
    // Do not use attributes for relative sizes, not supported in IE9.
    video.style.width = '100%';
    video.style.height = '100%';
  }

  $wrapper.html(video);
  this.$loading = H5P.jQuery('<div class="h5p-video-loading"></div>').appendTo($wrapper);
  this.video = video;
};

/**
 * Attaches a flash video player to the wrapper.
 *
 * @param {jQuery} $wrapper Our dear container.
 * @returns {undefined}
 */
H5P.Video.prototype.attachFlash = function ($wrapper) {
  var that = this;
  $wrapper = H5P.jQuery('<div class="h5p-video-flash" style="width:100%;height:100%"></div>').appendTo($wrapper);

  // Find supported sources.
  if (this.params.files !== undefined && this.params.files instanceof Object) {
    this.qualities = []; // Sort sources by quality.
  
    for (var i = 0; i < this.params.files.length; i++) {
      var file = this.params.files[i];

      // Only supported sources.
      if (file.mime === 'video/mp4') { 
        if (file.quality === undefined) {
          // Add default quality if source has none.
          file.quality = {
            level: 0,
            label: 'Default'
          };
        }
        
        if (this.qualities[file.quality.level] === undefined) {
          // Add new quality
          this.qualities[file.quality.level] = {
            label: file.quality.label,
            source: H5P.getPath(file.path, this.contentId)
          };
        }
      }
    }
    
    // Get preferred quality level through cookie.
    var videoSource = this.getPreferredQuality();
  }

  if (videoSource === undefined) {
    $wrapper.text('No supported video files found.');
    if (this.endedCallback !== undefined) {
      this.endedCallback();
    }
    return;
  }

  var options = {
    buffering: true,
    clip: {
      url: videoSource,
      autoPlay: this.params.autoplay === undefined ? false : this.params.autoplay,
      autoBuffering: true,
      scaling: 'fit',
      onSeek: function () {
        if (that.wasPlaying !== undefined) {
          delete that.lastTime;
          delete that.wasPlaying;
        }
      },
      onMetaData: function () { 
        /* Used before play:null
        if (that.params.controls === false) {
          that.flowplayer.getPlugin('play').hide();
        }*/
        setTimeout(function () {
          if (that.onLoad !== undefined) {
            that.onLoad();
            // onLoad is only used once.
            delete that.onLoad;
          }
        }, 1);
      }
    },
    plugins: {
      controls: null
    },
    play: null, // Disable overlay controls
    onPlaylistReplace: function () {
      that.playlistReplaced();
    }
  };
  
  if (this.params.controls === undefined || this.params.controls) {
    options.plugins.controls = {};
    delete options.play;
  }

  if (this.endedCallback !== undefined) {
    options.clip.onFinish = this.endedCallback;
  }

  if (this.errorCallback !== undefined) {
    options.onError = this.errorCallback;
  }
  
  if (this.loadedCallback !== undefined) {
    this.onLoad = this.loadedCallback;
  }

  this.flowplayer = flowplayer($wrapper[0], {
    src: "http://releases.flowplayer.org/swf/flowplayer-3.2.16.swf",
    wmode: "opaque"
  }, options);
};

/**
 * Play the clip.
 *
 * @returns {undefined}
 */
H5P.Video.prototype.play = function () {
  if (this.flowplayer !== undefined) {
    this.flowplayer.play();
  }
  else {
    this.video.play();
  }
};

/**
 * Pause the clip.
 *
 * @returns {undefined}
 */
H5P.Video.prototype.pause = function () {
  if (this.flowplayer !== undefined) {
    this.flowplayer.pause();
  }
  else {
    this.video.pause();
  }
};

/**
 * Stop the video.
 *
 * @returns {undefined}
 */
H5P.Video.prototype.stop = function () {
  if (this.flowplayer !== undefined) {
    this.flowplayer.stop().close().unload();
  }
  if (this.video !== undefined) {
    this.video.pause();
  }
};

/**
 * Get current time in clip.
 *
 * @returns Float
 */
H5P.Video.prototype.getTime = function () {
  if (this.flowplayer !== undefined) {
    return this.flowplayer.getTime();
  }
  else {
    return this.video.currentTime;
  }
};

/**
 * Get current time in clip.
 *
 * @returns Float
 */
H5P.Video.prototype.getDuration = function () {
  if (this.flowplayer !== undefined) {
    return this.flowplayer.getClip().metaData.duration;
  }
  else {
    return this.video.duration;
  }
};

/**
 * Jump to the given time in the video clip.
 *
 * @param {int} time
 * @returns {undefined}
 */
H5P.Video.prototype.seek = function (time) {
  if (this.flowplayer !== undefined) {
    this.flowplayer.seek(time);
  }
  else {
    var seekable = false;
    for (var i = 0; i < this.video.seekable.length; i++) {
      if (time >= this.video.seekable.start(i) && time <= this.video.seekable.end(i)) {
        seekable = true;
        break;
      }
    }

    if (seekable) {
      this.video.currentTime = time;
    }
  }
};

/**
 * Mute the video
 *
 * @returns {undefined}
 */
H5P.Video.prototype.mute = function () {
  if (this.flowplayer !== undefined) {
    this.flowplayer.mute();
  }
  else {
    this.video.muted = true;
  }
};

/**
 * Unmute the video
 *
 * @returns {undefined}
 */
H5P.Video.prototype.unmute = function () {
  if (this.flowplayer !== undefined) {
    this.flowplayer.unmute();
  }
  else {
    this.video.muted = false;
  }
};

/**
 * Resize the video DOM to use all available space.
 *
 * @returns {undefined}
 */
H5P.Video.prototype.resize = function () {
  if (this.flowplayer !== undefined) {
    var $object = H5P.jQuery(this.flowplayer.getParent()).children('object');
    var clip = this.flowplayer.getClip();

    if (clip !== undefined) {
      $object.css('height', $object.width() * (clip.metaData.height / clip.metaData.width));
    }
  }
  else if (this.video !== undefined) {
    var $video = H5P.jQuery(this.video);
    $video.css('height', '100%'); // Fixes size on ios7.
    $video.parent().css('height', $video.width() * (this.video.videoHeight / this.video.videoWidth));
  }
};

/**
 * Check if the video is playing.
 *
 * @returns {Boolean} Status
 */
H5P.Video.prototype.isPlaying = function () {
  if (this.flowplayer !== undefined) {
    return this.flowplayer.isPlaying();
  }
  else {
    return (this.video.paused === false && this.video.ended === false)
  }
};

/**
 * Set quality.
 *
 * @returns {undefined}
 */
H5P.Video.prototype.setQuality = function (level) {
  var that = this;
  
  // Keep track of last choice through cookies
  this.setPreferredQuality(level);
  
  // Keep track of state
  if (this.wasPlaying === undefined) {
    this.wasPlaying = this.isPlaying();
  }
  if (this.wasPlaying === true) {
    this.pause();
  }
  
  // Keep track of time
  if (this.lastTime === undefined) {
    this.lastTime = this.getTime() - 1; // Rewind one second
    if (this.lastTime < 0) {
      this.lastTime = 0;
    }
  }
  
  if (this.flowplayer !== undefined) {
    // Control flash player
    this.onLoad = function () {
      that.flowplayer.seek(that.lastTime);
      if (that.wasPlaying === true) {
        that.flowplayer.play();
      }
    }
    
    // Change source
    this.flowplayer.setClip(this.qualities[level].source);
    this.flowplayer.startBuffering();
  }
  else {
    // Hide loading screen after seeking.
    var seeked = function () {
      that.video.removeEventListener('seeked', seeked, false);
      that.$loading.hide();
    }
    that.video.addEventListener('seeked', seeked, false);
    
    // Seek and start video again after loading.
    var loaded = function () {
      that.video.removeEventListener('loadedmetadata', loaded, false);

      if (H5P.Video.android) {
        var andLoaded = function () {
          that.video.removeEventListener('durationchange', andLoaded, false);
          // On Android seeking isn't ready until after play.            
          that.seek(that.lastTime);
          delete that.lastTime;
        };
        that.video.addEventListener('durationchange', andLoaded, false);
      }
      else {
        // Seek to current time.    
        that.seek(that.lastTime);
        delete that.lastTime;
      }
  
      // Resume playing
      if (that.wasPlaying === true) {
        that.play();
      }
      delete that.wasPlaying;
    }
    this.video.addEventListener('loadedmetadata', loaded, false);

    // Show loading screen
    this.$loading.show();

    // Change source
    this.video.src = this.qualities[level].source; // Note that iPad does not support #t=.
  }
};

/**
 * Set Preferred video quality.
 *
 * @param {Number} level Index of preferred quality
 */
H5P.Video.prototype.setPreferredQuality = function (level) {
  var settings = document.cookie.split(';');
  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i].split('=');
    if (setting[0] === 'H5PVideoQuality') {
      setting[1] = level;
      settings[i] = setting.join('=');
      document.cookie = settings.join(';');
      return;
    }
  }
  
  document.cookie = 'H5PVideoQuality=' + level + '; ' + document.cookie;
}

/**
 * Return source of preferred video quality.
 *
 * @returns {String} URL or undefined if not found.
 */
H5P.Video.prototype.getPreferredQuality = function () {
  var level, settings = document.cookie.split(';');
  for (var i = 0; i < settings.length; i++) {
    var setting = settings[i].split('=');
    if (setting[0] === 'H5PVideoQuality') {
      level = setting[1];
      break;
    }
  }
  
  if (level === undefined || this.qualities[level] === undefined) {
    // Just pick the first/lowest quality source.
    for (level in this.qualities) {
      this.qualities[level]['default'] = true;
      return this.qualities[level].source;
      break;
    }
  }
  else {
    this.qualities[level]['default'] = true;
    return this.qualities[level].source;
  }
}


/**
 * Gather copyright information for the current content.
 *
 * @returns {H5P.ContentCopyrights}
 */
H5P.Video.prototype.getCopyrights = function () {
  if (this.copyright === undefined) {
    return;
  }
  
  var info = new H5P.ContentCopyrights();
  info.addMedia(new H5P.MediaCopyright(this.copyright));
  
  return info;
};
