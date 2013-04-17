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

/**
 * Wipe out the content of the wrapper and put our HTML in it.
 * 
 * @param {jQuery} $wrapper Our poor container.
 */
H5P.Video.prototype.attach = function ($wrapper) {
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
        source.src = (file.tmp !== undefined && file.tmp ? this.tmpPath : this.contentPath) + file.path;
        source.type = file.mime;
        video.appendChild(source);
      }
    }
  }
  
  if (!video.children) {
    $wrapper.text('No supported video files found.');
    return;
  }
  
  video.className = 'h5p-video';
  video.controls = this.params.controls === undefined ? true : this.params.controls;
  video.autoplay = this.params.autoplay === undefined ? false : this.params.autoplay;
  
  if (this.params.fitToWrapper === undefined || this.params.fitToWrapper) {
    video.setAttribute('width', '100%');
    video.setAttribute('height', '100%');
  }
  
  $wrapper.html(video);
};

/**
 * Attaches a flash video player to the wrapper.
 * 
 * @param {jQuery} $wrapper Our dear container.
 * @returns {undefined}
 */
H5P.Video.prototype.attachFlash = function ($wrapper) {
  if (this.params.files !== undefined) {
    for (var i = 0; i < this.params.files.length; i++) {
      var file = this.params.files[i];
      if (file.mime === 'video/mp4') {
        var videoSource = (file.tmp !== undefined && file.tmp ? this.tmpPath : this.contentPath) + file.path;
        break;
      }
    }
  }
  
  if (videoSource === undefined) {
    $wrapper.text('No supported video files found.');
  }
  
  var options = {
    buffering: true,
    clip: {
      url: window.location.protocol + '//' + window.location.host + videoSource,
      autoPlay: this.params.autoplay === undefined ? false : this.params.autoplay,
      autoBuffering: true,
      scaling: 'fit'
    },
    plugins: {}
  };
  
  if (this.params.controls === undefined || this.params.controls) {
    options.plugins.controls = {
      url: 'http://releases.flowplayer.org/swf/flowplayer.controls-tube-3.2.15.swf'
    };
  }
  
  this.flowplayer = flowplayer($wrapper[0], {
    src: "http://releases.flowplayer.org/swf/flowplayer-3.2.16.swf",
    wmode: "opaque"
  }, options);
};