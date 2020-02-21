import React, { Component } from "react";
import idx from "idx";
import { parse, visit } from "graphql";

const pascalCase = string => {
  const result = string
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
      if (+match === 0) return "";
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    })
    .replace(/\W+/g, "");

  const head = result.slice(0, 1);
  const rest = result.slice(1);

  return String(head.toLocaleUpperCase()) + rest;
};

const prUrlToPrNumber = prUrl => {
  // eslint-disable-next-line
  var [_, number] = prUrl.match(/pull\/(\d+)/) || [];
  return number;
};

async function fetchOneGraph(auth, operationsDoc, operationName, variables) {
  let origin = auth.oneGraphOrigin;

  const result = await fetch(`${origin}graphql?app_id=${auth.appId}`, {
    method: "POST",
    headers: {
      ...auth.authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: operationsDoc,
      variables: variables,
      operationName: operationName
    })
  });

  return await result.json();
}

const operationsDoc = `
  query FindMeQuery {
    me {
      github {
        databaseId
        name
        login
      }
    }
  }

  query FindUserPRContributionCount($query: String!) {
    gitHub {
      search(first: 1, query: $query, type: ISSUE) {
        contributionCount: issueCount
      }
    }
  }

  query FindSourceRepositoryId($repoOwner: String!, $repoName: String!) {
    gitHub {
      repository(owner: $repoOwner, name: $repoName) {
        id
      }
    }
  }
  
  mutation ForkGitHubRepo($repoOwner: String!, $repoName: String!) {
    gitHub {
      createFork_oneGraph(input: {repoOwner: $repoOwner, repoName: $repoName}) {
        repository {
          nameWithOwner
        }
      }
    }
  }
  
  query DoIHaveARepoQuery($repoOwner: String!, $repoName: String!) {
    gitHub {
      repository(owner: $repoOwner, name: $repoName) {
        id
      }
    }
  }
  
  mutation CreateBranchMutation($repoOwner: String!, $repoName: String!, $branchName: String!) {
    gitHub {
      createBranch_oneGraph(input: {branchName: $branchName, repoName: $repoName, repoOwner: $repoOwner}) {
        ref_: ref {
          name
          id
        }
      }
    }
  }
  
  mutation CreateFileMutation($repoOwner: String!, $repoName: String!, $branchName: String!, $path: String!, $message: String!, $content: String!) {
    gitHub {
      createOrUpdateFileContent_oneGraph(input: {message: $message, path: $path, repoName: $repoName, repoOwner: $repoOwner, branchName: $branchName, plainContent: $content}) {
        commit {
          message
        }
      }
    }
  }
  
  mutation CreatePullRequest($repoId: ID!, $title: String!, $headRefName: String!, $baseRefName: String!, $body: String!) {
    gitHub {
      createPullRequest(input: {title: $title, headRefName: $headRefName, baseRefName: $baseRefName, repositoryId: $repoId, maintainerCanModify: true, body: $body}) {
        pullRequest {
          url
          permalink
        }
      }
    }
  }
`;

function fetchFindMeQuery(auth) {
  return fetchOneGraph(auth, operationsDoc, "FindMeQuery", {});
}

function fetchFindUserPRContributionCount(auth, repoOwner, username) {
  const query = `org:${repoOwner} author:${username} type:pr is:merged`;
  return fetchOneGraph(auth, operationsDoc, "FindUserPRContributionCount", {
    query: query
  });
}

function fetchFindSourceRepositoryId(auth, repoOwner, repoName) {
  return fetchOneGraph(auth, operationsDoc, "FindSourceRepositoryId", {
    repoOwner: repoOwner,
    repoName: repoName
  });
}

function executeForkGitHubRepo(auth, repoOwner, repoName) {
  return fetchOneGraph(auth, operationsDoc, "ForkGitHubRepo", {
    repoOwner: repoOwner,
    repoName: repoName
  });
}

function fetchDoIHaveARepoQuery(auth, repoOwner, repoName) {
  return fetchOneGraph(auth, operationsDoc, "DoIHaveARepoQuery", {
    repoOwner: repoOwner,
    repoName: repoName
  });
}

function executeCreateBranchMutation(auth, repoOwner, repoName, branchName) {
  return fetchOneGraph(auth, operationsDoc, "CreateBranchMutation", {
    repoOwner: repoOwner,
    repoName: repoName,
    branchName: branchName
  });
}

function executeCreateFileMutation(
  auth,
  repoOwner,
  repoName,
  branchName,
  path,
  message,
  content
) {
  return fetchOneGraph(auth, operationsDoc, "CreateFileMutation", {
    repoOwner: repoOwner,
    repoName: repoName,
    branchName: branchName,
    path: path,
    message: message,
    content: content
  });
}

function executeCreatePullRequest(
  auth,
  repoId,
  title,
  headRefName,
  baseRefName,
  body
) {
  return fetchOneGraph(auth, operationsDoc, "CreatePullRequest", {
    repoId: repoId,
    title: title,
    headRefName: headRefName,
    baseRefName: baseRefName,
    body: body
  });
}

const makeExampleSubmitter = ({
  auth,
  username,
  exampleRepoId,
  examplesRepoInfo,
  branchName,
  title,
  body,
  example,
  variables,
  result
}) => {
  return [
    [
      "Forking examples repo",
      async () => {
        let { data, errors } = await fetchDoIHaveARepoQuery(
          auth,
          username,
          examplesRepoInfo.name
        );
        if (!!errors) console.warn(errors);

        let hasExamplesRepo = !!idx(data, _ => _.gitHub.repository.id);

        if (!hasExamplesRepo) {
          let { data, errors } = await executeForkGitHubRepo(auth);
          if (!!errors) console.warn(errors);

          hasExamplesRepo = !!idx(
            data,
            _ => _.gitHub.createFork_oneGraph.repository.nameWithOwner
          );
        }

        return hasExamplesRepo;
      }
    ],
    [
      "Creating branch for example",
      async () => {
        let { data, errors } = await executeCreateBranchMutation(
          auth,
          username,
          examplesRepoInfo.name,
          branchName
        );
        if (!!errors) console.warn(errors);

        const shouldContinue = !!idx(
          data,
          _ => _.gitHub.createBranch_oneGraph.ref_.id
        );

        return shouldContinue;
      }
    ],
    [
      "Creating example ",
      async () => {
        const safeTitle = pascalCase(title);
        const path = `src/examples/${safeTitle}.md`;
        let queryResult = null;
        try {
          queryResult = JSON.stringify(result);
        } catch (error) {
          console.warn("Malformed queryResult JSON", error);
        }
        const fullExample = prBody({
          title,
          body,
          username,
          example,
          variables,
          queryResult
        });

        const { data, errors } = await executeCreateFileMutation(
          auth,
          username,
          examplesRepoInfo.name,
          branchName,
          path,
          body,
          fullExample
        );
        if (!!errors) console.warn(errors);

        const shouldContinue = !!idx(
          data,
          _ => _.gitHub.createOrUpdateFileContent_oneGraph.commit.message
        );

        return shouldContinue;
      }
    ],
    [
      "Submitting the pull request",
      async setState => {
        const { data, errors } = await executeCreatePullRequest(
          auth,
          exampleRepoId,
          title,
          `${username}:${branchName}`,
          "master",
          body
        );
        if (!!errors) console.warn(errors);

        const url = idx(data, _ => _.gitHub.createPullRequest.pullRequest.url);

        if (!!url) {
          setState({ prUrl: url });
        }

        return url;
      }
    ]
  ];
};

const hardCodedValuesWarning = (hardCodedValues, variables, result) => {
  if (hardCodedValues.length === 0 && !variables && !result) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "rgb(238, 238, 238)",
        borderRadius: "4px",
        padding: "4px",
        fontSize: "small",
        marginBottom: "4px"
      }}
    >
      <h4>Caution: Your example exposes these values</h4>
      <ul style={codeBlockStyle}>
        {!!variables ? <li key="variables">variables: {variables}</li> : null}
        {!!result ? <li key="result">result: {result}</li> : null}

        {hardCodedValues
          .sort((a, b) =>
            insensitivelyCompareStrings(a.toString(), b.toString())
          )
          .map((value, idx) => {
            const element = typeof value === "string" ? <>"{value}"</> : value;
            return (
              <li key={value}>
                {idx + 1}: <code>{element}</code>
              </li>
            );
          })}
      </ul>
    </div>
  );
};

const prBody = ({ title, body, username, example, variables, queryResult }) => {
  const escapedVariables = (variables || "").replace(/"/g, '\\"');
  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedQueryResult = queryResult || "";
  const escapedBody = (body || "").replace(/\n/g, "\n  ");
  const fullExample = `---
description: |
  ${escapedBody}
contributedBy: "@${username}"
variables: "${escapedVariables || ""}"
title: "${escapedTitle}"
result: |
  ${escapedQueryResult}
---

\`\`\`graphql
${example}
\`\`\`
`;

  return fullExample;
};

const baseFieldStyle = {
  borderRadius: "4px",
  border: "1px solid rgb(238, 238, 238)",
  padding: "4px",
  width: "100%"
};

const codeBlockStyle = {
  backgroundColor: "#EEEEEE",
  fontFamily:
    "Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New",
  fontSize: "small",
  whiteSpace: "nowrap",
  overflow: "scroll"
};

const insensitivelyCompareStrings = (a, b) => {
  const upperA = a.toLocaleUpperCase();
  const upperB = b.toLocaleUpperCase();

  return upperA.localeCompare(upperB);
};

class SubmitExample extends Component {
  state = {
    showCopiedTooltip: false,
    title: null,
    description: null,
    variables: null,
    gitHubUsername: null,
    gitHubRepoId: null,
    oneGraphAuth: null,
    loading: false,
    step: null,
    prUrl: null,
    hardCodedValues: [],
    error: null,
    includeVariables: false,
    includeResult: false,
    contributionCount: 0
  };

  async _findMeOnGitHub(auth) {
    var { data, errors } = await fetchFindMeQuery(auth);
    if (!!errors) console.warn(errors);

    const gitHubUsername = idx(data, _ => _.me.github.login);

    if (gitHubUsername) {
      this.setState({ gitHubUsername }, async () => {
        const contributionCountPromise = fetchFindUserPRContributionCount(
          auth,
          this.props.exampleStorageRepo.owner,
          gitHubUsername
        );

        var { data, errors } = await fetchFindSourceRepositoryId(
          auth,
          this.props.exampleStorageRepo.owner,
          this.props.exampleStorageRepo.name
        );
        if (!!errors) console.warn(errors);
        const gitHubRepoId = idx(data, _ => _.gitHub.repository.id);
        // eslint-disable-next-line
        var { data, errors } = await contributionCountPromise;
        if (!!errors) console.warn(errors);
        const contributionCount =
          idx(data, _ => _.gitHub.search.contributionCount) || 0;

        this.setState({
          gitHubRepoId: gitHubRepoId,
          contributionCount: contributionCount
        });
      });
    } else {
      this.setState({ gitHubUsername: null });
    }
  }

  async _logInToGitHub(auth) {
    await auth.login("github");
    const isLoggedIn = await auth.isLoggedIn("github");
    if (isLoggedIn) {
      this._findMeOnGitHub(auth);
    }
  }

  async _logOutOfGitHub(auth) {
    await auth.logout("github");
    this._findMeOnGitHub(auth);
  }

  componentDidMount() {
    if (this.props.oneGraphAuth) {
      this.setState({ oneGraphAuth: this.props.oneGraphAuth }, () => {
        this._findMeOnGitHub(this.state.oneGraphAuth);
      });
    }

    const query = parse(this.props.query);

    const operations = [];

    visit(query, {
      OperationDefinition(node) {
        operations.push(node);
      }
    });

    const title = idx(operations[0], _ => _.name.value) || "UnnamedExample";

    this.setState({ title: title });
  }

  async _submitExample() {
    if (!this.state.title) {
      this.setState({ error: "Please set a title" });
      return;
    }

    if (!this.state.description) {
      this.setState({ error: "Please describe your example" });
      return;
    }

    this.setState({ error: null });

    const title = this.state.title;
    const body = this.state.description;
    const exampleRepoId = this.state.gitHubRepoId;
    const gitHubUsername = this.state.gitHubUsername;
    let variables = null;
    try {
      variables = JSON.stringify(JSON.parse(this.props.variables || "null"));
    } catch (e) {
      console.warn("Malformed JSON for variables", e);
    }

    let queryResult = null;
    try {
      queryResult = JSON.stringify(this.props.result);
    } catch (e) {
      console.warn("Malformed JSON for queryResult", e);
    }

    if (!this.props.oneGraphAuth) return null;
    if (!this.props.query) return null;
    if (!title) return null;
    if (!body) return null;
    if (!exampleRepoId) return null;
    if (!gitHubUsername) return null;

    const now = new Date();
    const dateString = `${now.getFullYear()}-${now.getMonth() +
      1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    const safeTitle = pascalCase(this.state.title || "");
    const branchName = `${dateString}-${safeTitle}`.toLocaleLowerCase();
    const options = {
      auth: this.props.oneGraphAuth,
      username: gitHubUsername,
      exampleRepoId: exampleRepoId,
      examplesRepoInfo: this.props.exampleStorageRepo,
      branchName: branchName,
      title: title,
      body: body,
      example: this.props.query,
      variables: this.state.includeVariables ? variables : null,
      result: this.state.includeResult ? queryResult : null
    };

    const submitter = makeExampleSubmitter(options);

    this.setState({ loading: true });

    const helper = async ([step, ...nextSteps]) => {
      if (step) {
        const [stepName, stepFn] = step;
        console.log("Entering ", stepName);
        this.setState({ step: stepName });
        const setState = this.setState.bind(this);
        const shouldContinue = await stepFn(setState);
        console.log(
          `Exiting ${stepName} with shouldContinue: ${shouldContinue}`
        );

        if (!!shouldContinue) {
          return await helper(nextSteps);
        } else {
          return false;
        }
      } else {
        return true;
      }
    };

    const result = await helper(submitter);
    this.setState({ loading: false, step: null });

    return result;
  }

  render() {
    console.log("Rendering example view....");

    const gitHubUsername = this.state.gitHubUsername;

    let hardCodedValues = [];
    let parsedQuery;

    try {
      parsedQuery = parse(this.props.query);

      const values = [];

      visit(parsedQuery, {
        StringValue(node) {
          values.push(node.value);
        },
        IntValue(node) {
          values.push(parseInt(node.value));
        }
      });

      hardCodedValues = Array.from(new Set(values));
    } catch (e) {
      console.warn("Error parsing query", e);
    }

    const preview = parsedQuery
      ? this.props.query
      : "Query is invalid, cannot submit";

    let variables = null;
    try {
      variables = JSON.stringify(JSON.parse(this.props.variables || ""));
    } catch (error) {
      console.warn("Malformed variables JSON", error);
    }

    let queryResult = null;
    try {
      if (this.props.result) {
        queryResult = JSON.stringify(this.props.result);
      }
    } catch (e) {
      console.warn("Malformed result JSON", e);
    }

    let thankYouMessage;
    if (this.state.contributionCount > 0) {
      const count = this.state.contributionCount;
      thankYouMessage = (
        <>
          Thank you for your <span style={{ color: "#397D13" }}>{count}</span>{" "}
          contribution{count === 1 ? "" : "s"}
        </>
      );
    }

    return (
      <div
        className="docExplorerWrap"
        style={{
          width: 440,
          minWidth: 440,
          zIndex: 7
        }}
      >
        <div className="doc-explorer-title-bar">
          <div className="doc-explorer-title">
            Share Query {gitHubUsername ? <> as @{gitHubUsername}</> : null}
          </div>
          <div className="doc-explorer-rhs">
            <div className="docExplorerHide" onClick={this.props.hidePanel}>
              {"\u2715"}
            </div>
          </div>
        </div>
        <div
          className="doc-explorer-contents"
          style={{
            borderTop: "1px solid #d6d6d6",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            maxHeight: "100%",
            flex: "auto"
          }}
        >
          <div
            style={{ flex: "none", flexDirection: "column", display: "flex" }}
          >
            <label>
              Title:
              <input
                onChange={event => this.setState({ title: event.target.value })}
                value={this.state.title || ""}
                placeholder={"AGoodTitle"}
                style={baseFieldStyle}
              />
            </label>
            <label>
              What does this query do?
              <br />
              <textarea
                onChange={event =>
                  this.setState({ description: event.target.value })
                }
                value={this.state.description || ""}
                rows={5}
                placeholder={"Describe your example for others"}
                style={baseFieldStyle}
              />
            </label>
            {!!this.props.variables ? (
              <label>
                <input
                  type="checkbox"
                  onClick={event => {
                    const includeVariables = !!event.target.checked;
                    this.setState({ includeVariables: includeVariables });
                  }}
                />
                Include your variables?
              </label>
            ) : null}
            {queryResult ? (
              <label>
                <input
                  type="checkbox"
                  onClick={event => {
                    const includeResult = !!event.target.checked;
                    this.setState({ includeResult: includeResult });
                  }}
                />
                Include example result?
              </label>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              flex: "auto",
              overflowY: "scroll",
              flexDirection: "column"
            }}
          >
            {hardCodedValuesWarning(
              hardCodedValues,
              this.state.includeVariables ? variables : null,
              this.state.includeResult ? queryResult : null
            )}
            <div
              style={{
                ...codeBlockStyle,
                borderRadius: "4px",
                padding: "4px"
              }}
            >
              <pre>
                <code>{preview}</code>
              </pre>
            </div>
          </div>
          <div
            style={{
              flex: "none",
              alignSelf: "flex-end",
              display: gitHubUsername ? "flex" : "block",
              alignItems: "baseline",
              width: "100%",
              padding: "4px",
              borderTop: "1px solid #e0e0e0"
            }}
          >
            {gitHubUsername ? (
              <>
                <div style={{ flexGrow: "2", padding: "4px" }}>
                  {this.state.error ? (
                    <span style={{ color: "#f1766c" }}>{this.state.error}</span>
                  ) : this.state.step ? (
                    this.state.step
                  ) : this.state.prUrl ? (
                    <a href={this.state.prUrl} target="blank">
                      Example PullRequest #
                      {prUrlToPrNumber(this.state.prUrl) || "?"} Created ↗
                    </a>
                  ) : (
                    thankYouMessage
                  )}
                </div>
                <div style={{ display: "flex" }}>
                  <button
                    className="toolbar-button"
                    style={{ maxHeight: "20px", flexGrow: "1", margin: "0px" }}
                    onClick={() => this._submitExample()}
                  >
                    Submit
                  </button>
                  <button
                    className="toolbar-button"
                    style={{ maxHeight: "20px", flexGrow: "1", margin: "0px" }}
                    onClick={() =>
                      this.state.oneGraphAuth &&
                      this._logOutOfGitHub(this.state.oneGraphAuth)
                    }
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div style={{ width: "100%" }}>
                <button
                  className="toolbar-button"
                  style={{ maxHeight: "20px", width: "95%", maxWidth: "95%" }}
                  onClick={() =>
                    this.state.oneGraphAuth &&
                    this._logInToGitHub(this.state.oneGraphAuth)
                  }
                >
                  Log into GitHub to share your example
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default SubmitExample;
