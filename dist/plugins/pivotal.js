'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var SCSF = require('../scsf');
var _url = require('url');
var request = require('request');
var Promise = require('bluebird');
var _ = require('lodash');

request.get = Promise.promisify(request.get, request);

/**
* Pivotal Tracker Interface
*/

var Pivotal = (function () {
  /**
  * Validates integration parameters and sets attributes
  * @param  {object} integration Required parameters for integration
  */

  function Pivotal(integration) {
    _classCallCheck(this, Pivotal);

    if (!('project' in integration)) {
      throw new Error('missing integration.project');
    }
    if (!('token' in integration)) {
      throw new Error('missing integration.token');
    }
    this.integration = integration;
    this.headers = {
      'X-TrackerToken': this.integration.token,
      'Content-Type': 'application/json'
    };
  }

  /**
  * Generates an API endpoint url
  * @param  {object} data object containing parts of the url to replace
  * @return {string} url
  */

  _createClass(Pivotal, [{
    key: 'url',
    value: function url(data) {
      var endpoint = 'https://www.pivotaltracker.com/services/v5/projects/' + this.integration.project + '/stories';

      var parsed = _url.parse(endpoint, true);

      if (typeof data != 'undefined') {
        parsed.query = {};
        delete parsed.search;
        if ('limit' in data) {
          parsed.query.limit = data.limit;
        }
        if ('offset' in data) {
          parsed.query.offset = data.offset;
        }
      }
      return parsed.format(parsed);
    }

    /**
    * Create stories at remote integration
    * @param  {array} stories Stories to create
    * @return {array} Stories that were created
    */
  }, {
    key: 'push',
    value: function push(stories) {
      var _this = this;

      return Promise.all(stories.map(function (story) {
        return new Promise(function (resolve, reject) {
          request.post(_this.url(), { headers: _this.headers, json: true, body: story }, function (err, res, body) {
            if (err) {
              return reject(err);
            }
            return resolve(Pivotal.toSCSF(body));
          });
        });
      }));
    }

    /**
    * Retrieve stories from remote integration
    * @return {array} Stories retrieved from remote integration
    */
  }, {
    key: 'pull',
    value: function pull() {
      return this._findAll({});
    }
  }, {
    key: '_query',
    value: function _query(query) {
      return request.get({ url: this.url(query), json: true, headers: this.headers }).spread(function (response, body) {
        var page = {
          total: parseInt(response.headers['x-tracker-pagination-total']),
          offset: parseInt(response.headers['x-tracker-pagination-offset']),
          returned: parseInt(response.headers['x-tracker-pagination-returned'])
        };
        return [response, body, page];
      });
    }
  }, {
    key: '_findAll',
    value: function _findAll(query) {
      var stories = [],
          skip = 0,
          promises = [];
      var that = this;
      return this._query(query).spread(function (response, body, page) {
        if (body === undefined) {
          body = [];
        }
        body.forEach(function (story) {
          stories.push(story);
        });
        skip = 0;
        while (skip < page.total) {
          skip += 100;
          var promise = that._query({ offset: skip }).spread(function (response, body, page) {
            body.forEach(function (story) {
              stories.push(story);
            });
            return stories;
          });
          promises.push(promise);
        }
        return Promise.settle(promises).spread(function () {
          return _.map(stories, function (story) {
            return Pivotal.toSCSF(story);
          });
        });
      });
    }
  }], [{
    key: 'toPivotal',
    value: function toPivotal(input) {
      var merged = SCSF.merge({ data: input });
      var data = merged.data;
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        kind: 'story',
        story_type: 'feature',
        created_at: data.date.created,
        updated_at: data.date.updated,
        project_id: data.project.id,
        current_state: (function (data) {
          if (data == 'completed') {
            return 'finished';
          } else {
            return 'unscheduled';
          }
        })(data)
      };
    }
  }, {
    key: 'toSCSF',
    value: function toSCSF(data) {
      var pivotal = {
        meta: {
          source: {
            name: 'pivotal',
            data: data
          }
        },
        data: {
          id: data.id,
          name: data.name,
          description: data.description,
          url: data.url,
          type: data.story_type,
          status: (function (data) {
            switch (data.current_state) {
              case 'unscheduled':
              case 'started':
              case 'finished':
              case 'delivered':
                return 'incomplete';
                break;
              case 'accepted':
                return 'complete';
                break;
            }
          })(data),
          date: {
            created: data.created_at,
            updated: data.updated_at
          },
          project: {
            id: data.project_id
          }
        }
      };
      return SCSF.merge(pivotal);
    }
  }]);

  return Pivotal;
})();

module.exports = Pivotal;