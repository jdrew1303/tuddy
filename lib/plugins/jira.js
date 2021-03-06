var SCSF = require('../scsf');
var JiraClient = require('jira-connector');

class Jira {
  constructor(integration) {
    if (!('host' in integration)) {
      throw new Error('missing integration.host');
    }
    if (!('username' in integration)) {
      throw new Error('missing integration.username');
    }
    if (!('password' in integration)) {
      throw new Error('missing integration.password');
    }
    this.integration = integration;
    this.headers = {

    }
    this.client = new JiraClient({
      host: this.integration.host,
      basic_auth: {
        username: this.integration.username,
        password: this.integration.password
      }
    });
  }
  push(stories) {
    return Promise.all(stories.map((story) => {
      return new Promise((resolve, reject) => {
        this.client.issue.createIssue({ fields: Jira.toJira(story) }, function(err, issue) {
          if (err) {
            return reject(err);
          }
          return resolve({
            id: issue.id,
            key: issue.key,
            url: issue.url
          });
        });
      });
    }));
  }
  /**
   * Retrieve stories from remote integration
   * @return {array} Stories retrieved from remote integration
   */
  pull() {
    return new Promise((resolve, reject) => {
      this.client.search.search({
      }, function(err, result) {
        if (err) {
          return reject(err);
        }
        return resolve(result.issues.map(Jira.toSCSF));
      });
    });
  }
  static toJira(input) {
    var merged = SCSF.merge({ data: input });
    var data = merged.data;
    return {
      id: data.id,
      self: data.self,
      key: data.key,
      created: data.date.created,
      updated: data.date.updated,
      duedate: data.date.due,
      summary: data.name,
      description: data.description,
      project: {
        id: data.project.id
      },
      issuetype: {
        name: data.type
      }
    }
  }
  static toSCSF(data) {
    var jira = {
      meta: {
        source: {
          name: 'jira',
          data: data
        }
      },
      data: {
        id: data.id,
        self: data.self,
        key: data.key,
        name: data.fields.summary,
        description: data.fields.description,
        type: data.fields.issuetype.name,
        date: {
          due: data.fields.duedate,
          created: data.fields.created,
          updated: data.fields.updated
        },
        project: {
          id: data.fields.project.id
        }
      }
    }
    return SCSF.merge(jira);
  }
}

module.exports = Jira;
