#!/usr/bin/env node

var fs = require("fs-extra");
var childProcess = require("child_process");
var which = require("which");
var semver = require("semver");
var path = require("path");

var packageHost = "https://package.elm-lang.org";

var packageRenames = {
  "NoRedInk/elm-decode-pipeline": "NoRedInk/elm-json-decode-pipeline",
  "elm-community/elm-test": "elm-explorations/test",
  "elm-lang/animation-frame": "elm/browser",
  "elm-lang/core": "elm/core",
  "elm-lang/html": "elm/html",
  "elm-lang/http": "elm/http",
  "elm-lang/svg": "elm/svg",
  "elm-lang/virtual-dom": "elm/virtual-dom",
  "elm-tools/parser": "elm/parser",
  "evancz/elm-markdown": "elm-explorations/markdown",
  "evancz/url-parser": "elm/url",
  "mgold/elm-random-pcg": "elm/random",
  "ohanhi/keyboard-extra": "ohanhi/keyboard",
  "thebritican/elm-autocomplete": "ContaSystemer/elm-menu",
  "elm-community/linear-algebra": "elm-explorations/linear-algebra",
  "elm-community/webgl": "elm-explorations/webgl",
  "elm-lang/keyboard": "elm/browser",
  "elm-lang/dom": "elm/browser",
  "mpizenberg/elm-mouse-events": "mpizenberg/elm-pointer-events",
  "mpizenberg/elm-touch-events": "mpizenberg/elm-pointer-events",
  "ryannhg/elm-date-format": "ryannhg/date-format",
  "rtfeldman/hex": "rtfeldman/elm-hex",
  "elm-lang/mouse": "elm/browser",
  "elm-lang/window": "elm/browser",
  "avh4/elm-transducers": "avh4-experimental/elm-transducers",
  "dillonkearns/graphqelm": "dillonkearns/elm-graphql"
};

var packageSplits = {
  "elm-lang/core": {
    "elm/json": ["Json.Decode", "Json.Encode"],
    "elm/random": ["Random"],
    "elm/time": ["Time", "Date"],
    "elm/regex": ["Regex"]
  }
};

function howToInstallElm() {
  return "Install Elm here https://guide.elm-lang.org/get_started.html#install\n";
}

function howToInstallElmFormat() {
  return "You can download Elm format here https://github.com/avh4/elm-format#installation-\n";
}

function displayHintForNonUpgradedPackage(packageName) {
  process.stdout.write(
    `WARNING: ${packageName} has not been upgraded to 0.19 yet!\n`
  );
}

function displaySuccessMessage(packagesRequiringUpgrade) {
  process.stdout.write(
    "SUCCESS! Your project's dependencies and code have been upgraded.\n" +
      "However, your project may not yet compile due to API changes in your\n" +
      "dependencies.\n\n" +
      "See <https://github.com/elm/compiler/blob/master/upgrade-docs/0.19.md>\n" +
      "and the documentation for your dependencies for more information.\n\n"
  );

  if (packagesRequiringUpgrade.length > 0) {
    process.stdout.write(
      // "WARNING! " +
      //   packagesRequiringUpgrade.length +
      //   " of your dependencies have not yet been upgraded to\n" +
      //   "support Elm 0.19. You can create an issue to request the packages be\n" +
      //   "upgraded here:\n"
      "WARNING! " +
        packagesRequiringUpgrade.length +
        " of your dependencies have not yet been upgraded to\n" +
        "support Elm 0.19.\n"
    );
    packagesRequiringUpgrade.forEach(function(packageName) {
      process.stdout.write(
        // "  - https://github.com/" + packageName + "/issues\n"
        "  - https://github.com/" + packageName + "\n"
      );
    });
    process.stdout.write("\n");
  }
}
/*
  Locate a binary based on name, if not found, error out with message
Provide binFolder in order to look there first
*/
function findBinary(binFolder, name, message) {
  var binary = null;

  // first look in binFolder
  try {
    binary = which.sync(name, { path: binFolder });
  } catch (e) {}

  // then just look all over path
  if (binary === null) {
    try {
      binary = which.sync(name);
    } catch (e) {
      process.stderr.write(message);
      process.exit(1);
    }
  }

  process.stdout.write("INFO: Found " + name + " at " + binary + "\n");
  return binary;
}

function saveElmJson(elmPackage) {
  fs.writeFileSync("elm.json", JSON.stringify(elmPackage, null, 4));
}

function findInFiles(roots, patterns) {
  return roots.some(function(root) {
    return fs.readdirSync(root).some(function(file) {
      var filename = path.join(root, file);
      if (file.slice(-4) === ".elm") {
        var contents = fs.readFileSync(filename, "utf8");
        return patterns.some(function(pattern) {
          return contents.match(pattern);
        });
      } else if (fs.statSync(filename).isDirectory()) {
        return findInFiles([filename], patterns);
      } else {
        return false;
      }
    });
  });
}

function main(knownUpgrades) {
  function hasBeenUpgraded(packageName) {
    return knownUpgrades.indexOf(packageName) > -1;
  }

  var localBinPath = "./node_modules/.bin/";
  var localFindBinary = findBinary.bind(null, localBinPath);

  var elm = localFindBinary(
    "elm",
    "ERROR: elm was not found on your PATH.  Make sure you have Elm 0.19 installed.\n" +
      howToInstallElm()
  );

  var elmUsage = childProcess.execFileSync(elm, ["--version"]);
  var elmVersion = elmUsage.toString().split("\n")[0];
  if (!elmVersion.match(/^0\.19\./)) {
    process.stderr.write(
      "ERROR: Elm 0.19 required, but found " +
        elmVersion +
        "\n" +
        howToInstallElm()
    );
    process.exit(1);
  }
  process.stdout.write("INFO: Found elm " + elmVersion + "\n");

  var elmFormat = localFindBinary(
    "elm-format",
    "ERROR: elm-format was not found on your PATH.  Make sure you have elm-format installed.\n" +
      howToInstallElmFormat()
  );

  var elmFormatUsage = childProcess.execFileSync(elmFormat);
  var elmFormatVersion = elmFormatUsage
    .toString()
    .split("\n")[0]
    .trim()
    .split(" ")[1];
  if (semver.lt(elmFormatVersion, "0.8.0")) {
    process.stderr.write(
      "ERROR: elm-format >= 0.8.0 required, but found " +
        elmFormatVersion +
        "\n" +
        howToInstallElmFormat()
    );
    process.exit(1);
  }
  process.stdout.write("INFO: Found elm-format " + elmFormatVersion + "\n");

  if (!fs.existsSync("elm-package.json")) {
    process.stderr.write(
      "ERROR: You must run the upgrade from a folder containing elm-package.json\n"
    );
    process.exit(1);
  }

  // TODO: Warning and prompt if git is not being used
  // TODO: Error if git workspace is dirty

  var elmPackage = JSON.parse(fs.readFileSync("elm-package.json", "utf8"));

  if (!elmPackage["elm-version"].startsWith("0.18.")) {
    process.stderr.write(
      "ERROR: This is not an Elm 0.18 project.  Current project uses Elm " +
        elmPackage["elm-version"] +
        "\n"
    );
    process.exit(1);
  }

  process.stdout.write("INFO: Cleaning ./elm-stuff before upgrading\n");
  fs.removeSync("elm-stuff");

  var packageName = elmPackage["repository"].match(
    /^https:\/\/github.com\/([^/]*\/[^/]*)\.git$/
  )[1];
  // TODO: Error if packageName doesn't parse

  process.stdout.write("INFO: Converting elm-package.json -> elm.json\n");

  var isPackage = elmPackage["exposed-modules"].length > 0;

  var elmJson;
  if (isPackage) {
    process.stdout.write(
      "INFO: Detected a package project (this project has exposed modules)\n"
    );

    if (elmPackage["license"] === "BSD3") {
      process.stdout.write(
        "INFO: Detected 'BSD3' license, which is not a valid SPDX license identifier; converting to 'BSD-3-Clause'\n"
      );
      elmPackage["license"] = "BSD-3-Clause";
    }

    elmJson = {
      type: "package",
      name: packageName,
      summary: elmPackage["summary"],
      license: elmPackage["license"],
      version: elmPackage["version"],
      "exposed-modules": elmPackage["exposed-modules"],
      "elm-version": "0.19.0 <= v < 0.20.0",
      dependencies: {
        "elm/core": "1.0.0 <= v < 2.0.0"
      },
      "test-dependencies": {}
    };
  } else {
    process.stdout.write(
      "INFO: Detected an application project (this project has no exposed modules)\n"
    );
    elmJson = {
      type: "application",
      "source-directories": elmPackage["source-directories"],
      "elm-version": "0.19.0",
      dependencies: {
        direct: {
          "elm/core": "1.0.0"
        },
        indirect: {
          "elm/json": "1.0.0"
        }
      },
      "test-dependencies": {
        direct: {},
        indirect: {}
      }
    };
  }
  saveElmJson(elmJson);

  var packagesToInstall = Object.keys(elmPackage["dependencies"]);

  var packagesRequiringUpgrade = [];

  packagesToInstall.forEach(function(packageName) {
    var oldPackageName = packageName;
    var renameTo = packageRenames[packageName];
    if (renameTo) {
      process.stdout.write(
        "INFO: Switching from " +
          packageName +
          " (deprecated) to " +
          renameTo +
          "\n"
      );
      packageName = renameTo;
    }

    if (!hasBeenUpgraded(packageName)) {
      displayHintForNonUpgradedPackage(packageName);
      if (isPackage) {
        // TODO: not tested
        packagesRequiringUpgrade[packageName] =
          elmPackage.dependencies[oldPackageName];
      } else {
        packagesRequiringUpgrade[packageName] = elmPackage.dependencies[
          oldPackageName
        ].split(" ")[0];
      }
      return;
    }

    process.stdout.write(
      "INFO: Installing latest version of " + packageName + "\n"
    );

    function installPackage(name) {
      try {
        childProcess.execFileSync(elm, ["install", name], {
          stdio: "inherit"
        });
      } catch (e) {
        process.stdout.write(`WARNING: Failed to upgrade ${name}!\n`);
      }
    }
    installPackage(packageName);

    var packageSplit = packageSplits[oldPackageName];
    if (packageSplit) {
      Object.keys(packageSplit).forEach(function(target) {
        var moduleNames = packageSplit[target];
        for (var i = 0; i < moduleNames.length; i++) {
          var moduleName = moduleNames[i];
          if (
            findInFiles(elmPackage["source-directories"], [
              RegExp("(^|[\n\r])import " + moduleName + "[ \n\r]")
            ])
          ) {
            process.stdout.write(
              "INFO: Detected use of " +
                oldPackageName +
                "#" +
                moduleName +
                "; installing " +
                target +
                "\n"
            );
            installPackage(target);
            break;
          }
        }
      });
    }
  });

  elmJson = JSON.parse(fs.readFileSync("elm.json", "utf8"));
  Object.keys(packagesRequiringUpgrade).forEach(function(name) {
    if (isPackage) {
      elmJson.dependencies[name] = packagesRequiringUpgrade[name];
    } else {
      elmJson.dependencies.direct[name] = packagesRequiringUpgrade[name];
    }
  });
  saveElmJson(elmJson);

  fs.unlinkSync("elm-package.json");

  // TODO: deal with source-directories for packages

  elmPackage["source-directories"].forEach(function(sourceDir) {
    if (!fs.existsSync(sourceDir)) {
      process.stdout.write(
        "WARNING: source directory " +
          sourceDir +
          " listed in your elm-package.json does not exist\n"
      );
    } else {
      process.stdout.write(
        "INFO: Upgrading *.elm files in " + sourceDir + "/\n"
      );
      childProcess.execFileSync(elmFormat, [
        "--upgrade",
        "--yes",
        "--elm-version",
        "0.19",
        sourceDir
      ]);
    }
  });

  process.stdout.write("\n\n");
  displaySuccessMessage(Object.keys(packagesRequiringUpgrade));
}

function init() {
  var got = require("got");
  var caw = require("caw");
  got(packageHost + "/search.json", { agent: caw() })
    .then(function(response) {
      var upgradedPackages = JSON.parse(response.body).map(function(p) {
        return p.name;
      });
      main(upgradedPackages);
    })
    .catch(function(err) {
      console.error(err);
      process.stderr.write(
        "ERROR: Unable to connect to " +
          packageHost +
          ".  Please try again later.\n"
      );
      process.exit(1);
    });
}

init();
