/** @namespace H5P */
H5P.VideoSchemaOrg = (function($) {

    /**
     * Video player for videos defined by the VideoObject schema.org standard.
     *
     * @class
     * @param {Array} sources Video files to use
     * @param {Object} options Settings for the player
     * @param {Object} l10n Localization strings
     */
    function SchemaOrg(sources, options, l10n) {
        var metadata = getMetadata(sources[0].path);

        // Only keep first source.
        var newsources = [sources[0]];
        var specs = getSourceAndMime(metadata);
        newsources[0].path = specs.path;
        newsources[0].mime = specs.mime;

        H5P.VideoHtml5.call(this, newsources, options, l10n);
    }

    /**
     * Check to see if we can play the first source.
     *
     * @public
     * @static
     * @param {Array} sources
     * @returns {Boolean}
     */
    SchemaOrg.canPlay = function(sources) {
        return getMetadata(sources[0].path);
    };

    /**
     * Extracts the source url and mime type of the first playable source from the json metadata.
     * Returns false if no playable source is found.
     *
     * @param {Object} metadata
     * @returns {{Object}|Boolean} Source url and mime type or false if not playable
     */
    var getSourceAndMime = function(metadata) {
        if (typeof metadata['contentUrl'] === 'string') {
            metadata['contentUrl'] = [metadata['contentUrl']];
        }

        if (Array.isArray(metadata['contentUrl'])) {
            for (let i = 0; i < metadata['contentUrl'].length; i++) {
                let mime = null;
                // Use specified encoding format as mime type if given.
                if ('encodingFormat' in metadata) {
                    if (typeof metadata['encodingFormat'] === 'string') {
                        mime = metadata['encodingFormat'];
                    } else {
                        mime = metadata['encodingFormat'][i];
                    }
                } else {
                    mime = H5P.VideoHtml5.getType({path: metadata['contentUrl'][i]});
                }

                if (H5P.VideoHtml5.canPlay([{
                    path: metadata['contentUrl'][i],
                    mime: mime
                }])) {
                    return {path: metadata['contentUrl'][i], mime: mime};
                }
            }
        }

        return false;
    }

    /**
     * Extract the metadata of a VideoObject from the given website.
     *
     * @private
     * @param {String} url
     * @returns {Object} VideoObject metadata
     */
    var getMetadata = function(url) {
        // Depends on HTML5 player.
        if (!H5P.VideoHtml5) {
            return false;
        }

        var metadata = false;

        $.get(
            {
                url: url,
                async: false
            })
            .done(content => {
                var parser = new DOMParser();
                var parsedHtml = parser.parseFromString(content, "text/html");

                var scripts = parsedHtml.getElementsByTagName('script');

                for (var item of scripts) {
                    if (item.getAttribute('type') === 'application/ld+json') {
                        var data = JSON.parse(item.text);
                        if (('@context' in data && data["@context"] === 'https://schema.org') &&
                            ('@type' in data && data["@type"] === 'VideoObject')) {
                            // Check if content url is given and if playable file exists.
                            if ('contentUrl' in data && getSourceAndMime(data)) {
                                metadata = data;
                                return;
                            }
                        }
                    }
                }
            });

        return metadata;
    };

    return SchemaOrg;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoSchemaOrg);