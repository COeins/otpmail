/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

	Components.utils.import("chrome://otpmail/content/otpcommon.js");

	var pro = new Array(null);
		
	function exportInitialize()
	{

		try
		{
			var keys = otpCommon.getKeys();
		}
		catch (ex)
		{
			alert(ex.toString());
			document.getElementById('otpExport').cancel();
		}

		for (var k in keys)
		{
			document.getElementById('exportSelectKey').appendItem(keys[k].id+" - "+keys[k].alias+" - "+keys[k].ringId, keys[k].id+":"+keys[k].ringId, null);
		}
	}

	function exportVerifyKey()
	{
		var key = document.getElementById('exportSelectKey').value;

		if (key == null)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Error", "Please select a key.");
			return false;
		}
		
		var ring = document.getElementById('exportSelectKey').value.split(":")[1];
		if (document.getElementById('exportRingPwd').value.length < 3)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please enter the Passphrase for key ring '"+ring+"'.");
			return false;
		}
		
		return true;
	}
	
	function exportVerifyTarget()
	{
		var dir = document.getElementById('exportDir').value;

		if (dir.length < 1)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Error", "Please select a target directory.");
			return false;
		}

		return true;
	}
	
	function exportSelectDir()
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		fp.init(window, "Select export directory", nsIFilePicker.modeGetFolder);

		var lf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		try
		{
			lf.initWithPath(document.getElementById('exportDir').value);
			fp.displayDirectory = lf;
		}
		catch (ex)
		{
		}

		if (fp.show() == nsIFilePicker.returnOK)
		{
			document.getElementById('exportDir').value = fp.file.path;
		}
	}

	function exportVerifyPwd()
	{
		var pw1 = document.getElementById('exportPassword1').value;
		var pw2 = document.getElementById('exportPassword2').value;

		if (pw1.length < 3)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Password Error", "Please enter the Passphrase for the exported key.\nPassphrases have to be at least 3 characters long.");
			return false;
		}
		
		if (pw1 != pw2)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Password Error", "Passphrases do not match.");
			return false;
		}
		
		return true;
	}
	
	function exportStart()
	{
		document.getElementById('otpExport').canAdvance = false;
		document.getElementById('otpExport').canRewind = false;

		var keyAndRing = document.getElementById('exportSelectKey').value.split(":");
		var keyId = keyAndRing[0];
		var ringId = keyAndRing[1];
		var ringPwd = document.getElementById('exportRingPwd').value;

		var targetDir = document.getElementById('exportDir').value;
		var targetPwd = document.getElementById('exportPassword1').value;

		var status = document.getElementById('exportStatus');
		var percent = document.getElementById('exportPercent');

		var pwd = ringPwd+"\n"+targetPwd;

		var input = "";
		var params = ["--export", targetDir, "--passphrase-stdin", "2", "--ring", ringId, "--key", keyId];

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
						}
					}
				}, function(exit, out, err)
				{
					pro = new Array(null);
					if (exit == 0)
					{
						document.getElementById('otpExport').goTo("ready");
						document.getElementById('otpExport').canAdvance = true;
						document.getElementById('otpExport').canRewind = false;
					}
					else
					{
						exportError(err);
					}
				});
		}
		catch (ex)
		{
			exportError(ex.message);
		}
	}

	function exportError(message)
	{
		otpCommon.msgBox(otpCommon.msgboxERR, "Error", message);
		document.getElementById('otpExport').goTo("start");
		document.getElementById('otpExport').canAdvance = true;
		document.getElementById('otpExport').canRewind = true;
	}
	
	function exportCancel()
	{
		if (pro[0] != null)
			pro[0].kill();
	}