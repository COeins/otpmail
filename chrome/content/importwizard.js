/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

	Components.utils.import("chrome://otpmail/content/otpcommon.js");

	var pro = new Array(null);
		
	function importInitialize()
	{

		try
		{
			var keys = otpCommon.getKeys();
		}
		catch (ex)
		{
			alert(ex.toString());
			document.getElementById('otpImport').cancel();
		}

		var keyrings = [];
		for (var k in keys)
		{
			if (keyrings.indexOf(keys[k].ringId) == -1)
				keyrings.push(keys[k].ringId);
		}

		document.getElementById('importSelectRing').appendItem("<create new ring>", "new", null);
		document.getElementById('importSelectRing').value="new";
		for (var k in keyrings)
		{
			document.getElementById('importSelectRing').appendItem(keyrings[k], keyrings[k], null);
		}

	}

	function importSelectFile()
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		fp.init(window, "Select import key", nsIFilePicker.modeOpen);
		fp.appendFilter("Key files","*.key");
		fp.appendFilters(nsIFilePicker.filterAll);

		var lf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

		try
		{
			lf.initWithPath(document.getElementById('importFile').value);
			fp.displayDirectory = lf.parent;
		}
		catch (ex)
		{
		}

		if (fp.show() == nsIFilePicker.returnOK)
		{
			document.getElementById('importFile').value = fp.file.path;
		}
	}

	function importStart()
	{
		document.getElementById('otpImport').canAdvance = false;
		document.getElementById('otpImport').canRewind = false;

		var inFile = document.getElementById('importFile').value;
		var inPwd = document.getElementById('importPassword').value;

		var alias = document.getElementById('importAlias').value;

		var ringId = document.getElementById('importSelectRing').value;
		var ringPwd = document.getElementById('importRingPwd').value;

		var status = document.getElementById('importStatus');
		var percent = document.getElementById('importPercent');

		var pwd = inPwd+"\n"+ringPwd;
		var input = alias + "\ny\n";
		var params = ["--import", inFile, "--passphrase-stdin", "2", "--ring", ringId];
		var keyid = "";
		
		try
		{
			var output = otpCommon.executeService(input, pwd, params, true, pro, function(string, err)
				{
					string = string.trim();
					if (string.length > 1)
					{
						var parse = string.split("%");
						if (parse.length > 1)
							percent.value = parse[0];
						else
						{
							status.value = string;
							parse = string.split(":");
							if (parse[0]=="Importing key")
								keyid=parse[1];
						}
					}
				}, function(exit, out, err)
				{
					pro = new Array(null);
					if (exit == 0)
					{
						try
						{
							if (keyid.length > 0)
							{
								var info = otpCommon.executeService("", ringPwd, "--passphrase-stdin --key-info" + keyid);
								document.getElementById('importOutput').value = info;
							}
						}
						catch (ex)
						{
							alert(ex.toString());
						}
						document.getElementById('otpImport').goTo("ready");
						document.getElementById('otpImport').canAdvance = true;
						document.getElementById('otpImport').canRewind = false;
					}
					else
					{
						importError(err);
					}
				});
		}
		catch (ex)
		{
			importError(ex.message);
		}
	}

	function importVerifyFile()
	{
		if (document.getElementById('importFile').value.length < 1)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please select the key file to import.");
			return false;
		}
		if (document.getElementById('importPassword').value.length < 3)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please enter the Passphrase for the imported key.");
			return false;
		}
	}

	function importVerifyPwd()
	{
		var ring = document.getElementById('importSelectRing').value;
		if (document.getElementById('importRingPwd').value.length < 3)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please enter the Passphrase for key ring '"+ring+"'.\nPassphrases have to be at least 3 characters long.");
			return false;
		}
	}

	function importError(message)
	{
		otpCommon.msgBox(otpCommon.msgboxERR, "Error", message);
		document.getElementById('otpImport').goTo("start");
		document.getElementById('otpImport').canAdvance = true;
		document.getElementById('otpImport').canRewind = true;
	}
	
	function importCancel()
	{
		if (pro[0] != null)
			pro[0].kill();
	}