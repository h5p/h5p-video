var H5P = H5P || {};

/**
 * Constructor.
 *
 * @param {object} params Options for this library.
 * @param {string} contentPath The path to our content folder.
 */
H5P.Video = function (params, contentPath) {
  this.params = params;
  this.contentPath = contentPath;

  if (window['H5PEditor'] !== undefined) {
    this.tmpPath = H5PEditor.filesPath + '/h5peditor/';
  }
};

// For android specific stuff.
H5P.Video.android = navigator.userAgent.indexOf('Android') !== -1;

/**
 * Wipe out the content of the wrapper and put our HTML in it.
 *
 * @param {jQuery} $wrapper Our poor container.
 */
H5P.Video.prototype.attach = function ($wrapper) {
//  this.attachFlash($wrapper);return;
  var that = this;

  // Check if browser supports video.
  var video = document.createElement('video');
  if (video.canPlayType === undefined) {
    // Try flash
    this.attachFlash($wrapper);
    return;
  }

  // Add supported source files.
  if (this.params.files !== undefined) {
    for (var i = 0; i < this.params.files.length; i++) {
      var file = this.params.files[i];

      if (video.canPlayType(file.mime)) {
        var source = document.createElement('source');
        // TODO: Clean up tmp stuff.
        source.src = (file.path.substr(0, 7) === 'http://' ? '' : (file.tmp !== undefined && file.tmp ? this.tmpPath : this.contentPath)) + file.path;
        source.type = file.mime;
        video.appendChild(source);
      }
    }
  }

  if (!video.children.length) {
    // Try flash
    this.attachFlash($wrapper);
    return;
  }

  if (this.endedCallback !== undefined) {
    video.addEventListener('ended', this.endedCallback, false);
  }

  if (this.loadedCallback !== undefined) {
    if (H5P.Video.android) {
      var play = function () {
        video.addEventListener('durationchange', function (e) {
          // On Android duration isn't available until after play.
          that.loadedCallback();
        }, false);
        video.removeEventListener('play', play ,false);
      };
      video.addEventListener('play', play, false);
    }
    else {
      video.addEventListener('loadedmetadata', this.loadedCallback, false);
    }
  }

  video.className = 'h5p-video';
  video.controls = this.params.controls === undefined ? true : this.params.controls;
  video.autoplay = this.params.autoplay === undefined ? false : this.params.autoplay;

  if (this.params.fitToWrapper === undefined || this.params.fitToWrapper) {
    video.setAttribute('width', '100%');
    video.setAttribute('height', '100%');
  }

  $wrapper.html(video);
  this.video = video;
};

/**
 * Attaches a flash video player to the wrapper.
 *
 * @param {jQuery} $wrapper Our dear container.
 * @returns {undefined}
 */
H5P.Video.prototype.attachFlash = function ($wrapper) {
  $wrapper = H5P.jQuery('<div class="h5p-video-flash" style="width:100%;height:100%"></div>').appendTo($wrapper);

  if (this.params.files !== undefined) {
    for (var i = 0; i < this.params.files.length; i++) {
      var file = this.params.files[i];
      if (file.mime === 'video/mp4') {
        var videoSource = (file.path.substr(0, 7) === 'http://' ? '' : window.location.protocol + '//' + window.location.host + (file.tmp !== undefined && file.tmp ? this.tmpPath : this.contentPath)) + file.path;
        break;
      }
    }
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
      scaling: 'fit'
    },
    plugins: {
      controls: null
    }
  };

  if (this.params.controls === undefined || this.params.controls) {
    options.plugins.controls = {};
  }

  if (this.endedCallback !== undefined) {
    options.clip.onFinish = this.endedCallback;
    options.clip.onError = this.endedCallback;
  }

  if (this.loadedCallback !== undefined) {
    options.clip.onMetaData = this.loadedCallback;
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
    this.video.currentTime = time;
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

    $object.css('height', $object.width() * (clip.metaData.height / clip.metaData.width));
  }
  else {
    var $video = H5P.jQuery(this.video);
    $video.css('height', $video.width() * (this.video.videoHeight / this.video.videoWidth));
  }
};