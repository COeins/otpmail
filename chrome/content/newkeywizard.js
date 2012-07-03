/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

	Components.utils.import("chrome://otpmail/content/otpcommon.js");

	var pro = new Array(null);
		
	function newkeyInitialize()
	{

		try
		{
			var keys = otpCommon.getKeys();
		}
		catch (ex)
		{
			alert(ex.toString());
			document.getElementById('otpCreate').cancel();
		}

		var keyrings = [];
		for (var k in keys)
		{
			if (keyrings.indexOf(keys[k].ringId) == -1)
				keyrings.push(keys[k].ringId);
		}

		document.getElementById('newkeySelectRing').appendItem("<create new ring>", "new", null);
		document.getElementById('newkeySelectRing').value="new";

		for (var k in keyrings)
		{
			document.getElementById('newkeySelectRing').appendItem(keyrings[k], keyrings[k], null);
		}

	}

	function newKeyVerifySize()
	{
		if (document.getElementById('newkeySize').value < 1)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please enter at least a size of 1 MByte.");
			return false;
		}
	}
	
	function newKeyVerifyPwd()
	{
		var ring = document.getElementById('newkeySelectRing').value;
		if (document.getElementById('newkeyPwd').value.length < 3)
		{
			otpCommon.msgBox(otpCommon.msgboxERR, "Input Error", "Please enter the Passphrase for key ring '"+ring+"'.\nPassphrases have to be at least 3 characters long.");
			return false;
		}
	}

	function newkeyStart()
	{
		document.getElementById('otpCreate').canAdvance = false;
		document.getElementById('otpCreate').canRewind = false;

		var ring = document.getElementById('newkeySelectRing').value;
		var size = document.getElementById('newkeySize').value;
		if (document.getElementById('newkeySizeUnit').value == "g")
			size *= 1024;

		var alias = document.getElementById('newkeyAlias').value;
		var pwd = document.getElementById('newkeyPwd').value;
		var status = document.getElementById('newkeyStatus');
		var percent = document.getElementById('newkeyPercent');

		var input = size + "\n" + alias + "\ny\n";
		var params = "--gen-key --passphrase-stdin --ring " + ring;
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
							if (parse[0]=="Creating new key")
								keyid=parse[1];
						}
					}
				}, function(exit, out, err)
				{
					pro = new Array(null);
					if (exit == 0)
					{
						if (keyid.length > 0)
						{
							var info = otpCommon.executeService("", pwd, "--passphrase-stdin --key-info" + keyid);
							document.getElementById('newkeyOutput').value = info;
						}

						document.getElementById('otpCreate').goTo("ready");
						document.getElementById('otpCreate').canAdvance = true;
						document.getElementById('otpCreate').canRewind = false;
					}
					else
					{
						newkeyError(err);
					}
				});
		}
		catch (ex)
		{
			newkeyError(ex.message);
		}
	}

	function newkeyError(message)
	{
		otpCommon.msgBox(otpCommon.msgboxERR, "Error", message);
		document.getElementById('otpCreate').goTo("start");
		document.getElementById('otpCreate').canAdvance = true;
		document.getElementById('otpCreate').canRewind = true;
	}
	
	function newkeyCancel()
	{
		if (pro[0] != null)
			pro[0].kill();
	}