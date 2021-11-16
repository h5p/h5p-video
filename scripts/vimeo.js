/** @namespace H5P */
H5P.VideoVimeo = (function ($) {

  function VimeoPlayer(sources, options, l10n) {
    const self = this;

    let player;
    let playbackRate = 1;
    const id = 'h5p-vimeo-' + numInstances;
    numInstances++;
    const $wrapper = $('<div/>');
    let duration = 0;
    let currentTime = 0;
    
    let qualities = [];
    const $placeholder = $('<div/>', {
      id: id,
      //text: l10n.loading
    }).appendTo($wrapper);

    const create = function () {
      if (!$placeholder.is(':visible') /*|| player !== undefined*/) {
        //return;
      }

      if (window.Vimeo === undefined) {
        // Load API first
        loadAPI(create);
        return;
      }

      /*
      if (player) {
        player.off('loaded');
        player.off('playing');
        player.off('pause');
        player.off('timeupdate');
      }*/

      const videoId = getId(sources[0].path);

      let width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      const options = {
        id: videoId,
        controls: false,
        responsive: true,
        dnt: true,
        width: width,
        height: width * (9/16)
      };

      player = new Vimeo.Player(id, options);
      
      player.on('loaded', function () {

        console.log('LOADED');

        Promise.all([
          player.getDuration().then(dur => {
            duration = dur;
          }),
          player.getQualities().then(function(qual) {
            // qualities = an array of quality objects
            console.log('Qualities', qual);

            for (let i=0; i < qual.length; i++) {
              qualities[i] = {
                name: qual[i].id,
                label: qual[i].label
              };
            }
          })
        ]).then(function () {
          player.getTextTracks().then(function(tracks) {
            console.log('Tracks', tracks);

            const trackOptions = [];
            for (var i = 0; i < tracks.length; i++) {
              trackOptions.push(new H5P.Video.LabelValue(tracks[i].label, tracks[i].language));
            }

            self.trigger('ready');
            self.trigger('loaded');
            self.trigger('captions', trackOptions);
          });
        });
      }); 

      player.on('playing', function () {
        console.log('PLAYING');
        self.trigger('stateChange', H5P.Video.PLAYING);
      });

      player.on('pause', function () {
        console.log('PAUSING');
        self.trigger('stateChange', H5P.Video.PAUSED);
      });

      player.on('timeupdate', function (time) {
        currentTime = time.seconds;
      });
    }

    /**
     * Appends the video player to the DOM.
     *
     * @public
     * @param {jQuery} $container
     */
    self.appendTo = function ($container) {
      $container.addClass('h5p-vimeo').append($wrapper);
      create();
    };

    self.getQualities = function () {
      return qualities;
    };

    self.getQuality = function () {};

    self.setQuality = function (quality) {
      console.log('setQuality', quality);
      player.setQuality(quality);
    };

    self.play = function () {
      console.log('PLAY');
      player.play();
    };

    self.pause = function () {
      console.log('PAUSE');
      if (player) {
        player.pause();
      }
    };

    self.seek = function (time) {
      console.log('SEEK');
      player.setCurrentTime(time);
    };

    self.getCurrentTime = function () {
      console.log('GETCURRENTTIME');
      return currentTime;
    };

    self.getDuration = function () {
      console.log('GETTING DURATION');
      return duration;
    };

    self.getPlayerState = function () {

    };

    self.getBuffered = function () {};

    self.mute = function () {
      player.setMuted(true);
    };

    self.unMute = function () {
      player.setMuted(false);
    };

    self.isMuted = function () {

    };

    self.getVolume = function () {};

    self.setVolume = function (level) {
      player.setVolume(level);
    };

    self.getPlaybackRates = function () {
      return [0.5, 1, 1.5, 2];
    };

    self.getPlaybackRate = function () {};

    self.setPlaybackRate = function (rate) {
      player.setPlaybackRate(rate);
    };

    self.setCaptionsTrack = function (track) {
      console.log('setCaptionsTrack', track);
      player.enableTextTrack(track.value);
    };

    self.getCaptionsTrack = function () {
      //return track;
    };

    self.on('resize', function () {
      if (!$wrapper.is(':visible')) {
        return;
      }

      // Use as much space as possible
      $wrapper.css({
        width: '100%',
        height: '100%'
      });

      const width = $wrapper[0].clientWidth;
      const height = options.fit ? $wrapper[0].clientHeight : (width * (9/16));

      // Validate height before setting
      if (height > 0) {
        // Set size
        $wrapper.css({
          width: width + 'px',
          height: height + 'px'
        });
      }
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
  VimeoPlayer.canPlay = function (sources) {
    // TODO - Hardcoded for now - need to use getId together with path

    console.log('VimeoPlayer.canPlay');
    return true;
    //return getId(sources[0].path) !== undefined;
  };

  /**
   * Find id of Vimeo video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} YouTube video identifier
   */

  const getId = function (url) {
    // Has some false positives, but should cover all regular URLs that people can find
    /*const matches = url.match(/(?:(?:youtube.com\/(?:attribution_link\?(?:\S+))?(?:v\/|embed\/|watch\/|(?:user\/(?:\S+)\/)?watch(?:\S+)v\=))|(?:youtu.be\/|y2u.be\/))([A-Za-z0-9_-]{11})/i);
    if (matches && matches[1]) {
      return matches[1];
    }*/

    // TODO - Hardcoded for now - need to create regexp
    return '558162919';
  };

  /**
   * Load the IFrame Player API asynchronously.
   */
  const loadAPI = function (loaded) {

    if (window.Vimeo) {
      return loaded();
    }

    const tag = document.createElement('script');
    tag.src="https://player.vimeo.com/api/player.js";
    tag.onload = loaded;
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  };

  let numInstances = 0;

  return VimeoPlayer;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoVimeo);