
const PATH = require("path");
const FS = require("fs-extra");
const SPAWN = require("child_process").spawn;


function main (callback) {

	function findProjectRoot (path, callback) {
		if (FS.existsSync(PATH.join(path, ".git"))) {
			console.log("Using project root:", path);
			return callback(null, path);
		}
		var newPath = PATH.dirname(path);
		if (newPath === path) {
			return callback(new Error("No project root found!"));
		}
		return findProjectRoot(newPath, callback);
	}

	return findProjectRoot(process.cwd(), function (err, rootPath) {
		if (err) return callback(err);

		function runCommands (commands, callback) {
		    var proc = SPAWN("bash", [
		        "-s"
		    ], {
		    	cwd: rootPath
		    });

		    proc.on("error", function(err) {
		    	return callback(err);
		    });
		    proc.stdout.on('data', function (data) {
				return process.stdout.write(data);
		    });
		    proc.stderr.on('data', function (data) {
				return process.stderr.write(data);
		    });
		    proc.stdin.write(commands.join("\n"));
		    proc.stdin.end();
		    return proc.on('close', function (code) {
		    	if (code) {
		    		return callback(new Error("Commands exited with code: " + code));
		    	}
		        return callback();
		    });
		}

		return runCommands([
	    	// @source http://stackoverflow.com/a/2658301
	    	'function evil_git_dirty {',
			'  [[ $(git diff --shortstat 2> /dev/null | tail -n1) != "" ]] && echo "*"',
			'}',
			// TODO: Prevent this from writing to stdout during if comparison.
			'if evil_git_dirty = "*"; then',
			'  echo "Commit changes to git first!";',
			'  exit 1;',
			'fi',
			'git checkout -b gh-pages',
			'git checkout gh-pages',
			'git merge master',
		], function (err) {
			if (err) return callback(err);

			var toPath = null;

			var indexFile = FS.readFileSync(PATH.join(__dirname, "../lib/templates/index.html"), "utf8");
			indexFile = indexFile.replace(/%boot\.bundle\.uri%/g, "fireconsole/bundles/plugin.js");
			indexFile = indexFile.replace(/%boot\.loader\.uri%/g, "fireconsole/bundles/loader.js");
			toPath = PATH.join(rootPath, "index.html");
			console.log("Writing file to:", toPath);
			FS.outputFileSync(toPath, indexFile);

			toPath = PATH.join(rootPath, "fireconsole/bundles/loader.js");
			console.log("Writing file to:", toPath);
			FS.copySync(PATH.join(__dirname, "../node_modules/pinf-loader-js/loader.js"), toPath);

			// TODO: Remove files that are not needed from branch (i.e. delete and ensure removed from git)

			return runCommands([
				'git add .',
				'git commit -m "[pinf-for-github-pages] Wrote boot files"',
				'git push origin',
				'git checkout master'
			], function (err) {
				if (err) return callback(err);

				return callback(null);
			});
		});
	});
}


if (require.main === module) {
	main(function (err) {
		if (err) {
			console.error(err.stack);
		}
	});
}
