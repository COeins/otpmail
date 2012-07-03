/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

Components.utils.import("resource://otpmail/subprocess.jsm")

var EXPORTED_SYMBOLS = [ "otpCommon" ];

var otpCommon =
{

	phrase: null,
	phrasetime: null,
	phrasetimer: null,
	phrasering: null,
	phraseerror: false,
	phrasetimedelay: 10*60*1000,
	
	getKeys: function()
	{
		var keylist = this.executeService("", "", "--list-keys").split("\n");
		var keys = [];
		for (var k in keylist)
		{
			var k1 = keylist[k].split(";");
			if (k1.length >= 2 && k1[0].length==8)
				keys.push({ id: k1[0], ringId: k1[1], alias: k1[2] });
		}
		return keys;
	},
	
	encryptText: function(input)
	{
		var keys = this.getKeys();

		var keynames = [];
		for (var k in keys)
			keynames.push(keys[k].id+" - "+keys[k].alias+" - "+keys[k].ringId);

		var keypos = this.msgBox(this.msgboxSELECT, "Select key", "Please select the key for encryption:", keynames);

		if (keypos != null)
		{
			var key = keys[keypos].id;
			var ring = keys[keypos].ringId;
			var space = "";
			//handle strange utf-8-conversion
			for (var i = 0; i < input.length; i++)
			{
				if (input.charCodeAt(i) > 127)
					space += " ";
			}
			return this.callService(input+space, ring, "-e -a --quiet --key " + key);
		}
		else
			throw { code: -1, cause: null, message: "Cancelled by user" };

	},
	
	decryptText: function(input)
	{
		try
		{
			return this.executeService(input, null, "--quiet --passphrase-stdin 0 --no-interactivity -d");
		}
		catch (ex)
		{
			if (ex.code!=2)
			{
				dump(ex.message+"\n");
				throw ex;
			}
			var error = ex.message.split(":")
			var ring = error[1].trim().substr(0, 8);
			var out =  this.callService(input, ring, "-d --quiet");
			return out;
		}
	},

	denyText: function(oldMsg, newText)
	{
		try
		{
			this.executeService(oldMsg, null, "--quiet --passphrase-stdin 0 --no-interactivity -d");
		}
		catch (ex)
		{
			if (ex.code!=2)
			{
				dump(ex.message+"\n");
				throw ex;
			}
			var error = ex.message.split(":")
			var ring = error[1].trim().substr(0, 8);

			var space = "";
			//handle strange utf-8-conversion
			for (var i = 0; i < newText.length; i++)
			{
				if (newText.charCodeAt(i) > 127)
					space += " ";
			}
			return this.callService(oldMsg + "\n" + newText + space, ring, "--modify-key");
		}
	},

	manageKey: function(command)
	{
		var keys = this.getKeys();
		
		var keynames = [];
		for (var k in keys)
			keynames.push(keys[k].id + " - " + keys[k].alias + " - " + keys[k].ringId);

		var keypos = this.msgBox(this.msgboxSELECT, "Select key", "Please select the key:", keynames);
		if (keypos != null)
		{
			// " --key "
			return this.callService("", keys[keypos].ringId, command + " " + keys[keypos].id);
		}
		else
			throw { code: -1, cause: null, message: "Cancelled by user" };
	},
	
	getPassphrase: function(ring, force)
	{		
		if (this.phrase == null || ring == null || ring != this.phrasering || this.phraseerror)
			force = true;

		prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.otpmail.");
		var cache = prefs.getBoolPref("cachephrase");
		var now = new Date();
		
		if (!force && now.getTime() - this.phrasetime < this.phrasetimedelay)
		{
			return this.phrase;
		}
		else
		{
			this.phrase = null;
			if (this.phrasetimer != null)
				this.phrasetimer.cancel();

			var text = "Please enter the passphrase for key ring "+ring+":";
			if (this.phraseerror)
				text = "Wrong passphrase.\n"+text;

			var pwd = this.msgBox(this.msgboxPASSWD, "Passphrase", text);
			if (pwd !=null)
			{
				this.phrase = pwd;

				if (cache)
				{
					this.phrasetime = now.getTime();
					this.phrasering = ring;
					this.phraseerror = false;
					this.phrasetimer = this.setTimeout(function()
					{
						otpCommon.clearPassphrase();
					}, this.phrasetimedelay);
				}
				return pwd;
			}
			else
			{
				throw { code: -1, cause: null, message: "Cancelled by user" };
			}
		}
	},

	clearPassphrase: function()
	{
		this.phrase = null;
	},

	// Enigmail enigmailCommon.jsm / setTimeout / 1152
  setTimeout: function(callbackFunction, sleepTimeMs)
	{
		var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    timer.initWithCallback(callbackFunction, sleepTimeMs, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    return timer;
  },

	callService: function (input, ring, params)
	{
		while (true)
		{
			var pwd = this.getPassphrase(ring)
			
			try
			{
				return this.executeService(input, pwd, "--passphrase-stdin --no-interactivity "
					+ params);
			}
			catch (ex)
			{
				if (ex.code == 2) // question
				{
					var ans = this.msgBox(this.msgboxYESNO, "Question", ex.out);
					if (ans == true)
						params += " --yes";
					else if (ans == false)
						params += " --no";
					else
						throw ex
				}
				else if (ex.code == 3) // wrong pwd
					this.phraseerror = true;
				else
					throw ex;
			}

		}
	},

	executeService: function (input, pwd, params, dontwait, refProcess, cbOutput, cbFinish)
	{
		var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.otpmail.");
		
		var libType; // 1: unix ; 2: windows
		var libName; // something like 'libc.so.6' or 'kernel32.dll'
		var javaCmd;
		var exitShift;

		try
		{
			var jarloc = prefs.getCharPref("otpjar");
			var keypath = prefs.getCharPref("keydir");
			var javaCmd = prefs.getCharPref("javaexe");
		}
		catch (ex)
		{
			this.msgBox(this.msgboxERR, "Please set up OTPmail" , "For OTPmail to work some paths need to be configured. Please call OTPmail setup and try again afterwards.");
			throw { code: -1, cause: null, message: "Please set up paths." };
		}
	
		if (xulRuntime.OS.indexOf("WIN")===0)
		{
			//dump ("win\n");
			libType = 2;
			libName = "kernel32.dll";
			exitShift = 1;
		}
		else
		{
			//dump ("linux\n");
			libType = 1;
			libName = "libc.so.6";
			exitShift = 256;
		}
		
		var prm = [ "-jar", jarloc, "--basedir", keypath ];

		if (typeof(params) == 'string')
		{
			prm = prm.concat(params.split(" "));
		}
		else
		{
			prm = prm.concat(params);
		}
		
		var output = null;
		
		dump("Calling: "+javaCmd+" "+prm.join(" ")+"\n");

		if (prefs.getBoolPref("debug"))
		{
			if (!this.msgBox(this.msgboxYESNO, "Call service?" , javaCmd+" "+prm.join(" ")))
				throw { code: -1, cause: null, message: "Cancelled by user" };
		}
		
		var out = "";
		var err = "";
		var exit = -1;
		
		try
		{
			var that = this;
			var in1 = input;
			if (pwd != null)
				in1 = pwd+"\n"+in1;


			var pro = subprocess.call(
			{
				libType:	libType,
				libc:	libName,
				command:	javaCmd,
				workdir:	".", //keypath,
				arguments:	prm,
				charset:	null,
				stdin: in1,
				stdout: function(data)
				{
					out += data;
					if (cbOutput != null)
					{
						var lines = data.split("\n");
						for (var key in lines)
							cbOutput(lines[key], false);
					}
				},
				stderr: function(data)
				{
					err += data;
					if (cbOutput != null)
					{
						var lines = data.split("\n");
						for (var key in lines)
							cbOutput(lines[key], true);
					}
				},
				done: function(result)
				{
					exit = result.exitCode / exitShift;
					
					dump("Return value: "+ exit +"\n");
					if (prefs.getBoolPref("debug"))
						otpCommon.msgBox(otpCommon.msgboxOK, "Process Finished" , "Return value: "+ exit +"\n"+"Error output: "+result.stderr);
					
					out += result.stdout;
					err += result.stderr;
					output = result;
					
					if (cbFinish != null)
						cbFinish(exit, out, err);
				},
				mergeStderr: false
			});
		}
		catch (ex)
		{
			throw { code: -1, cause: ex, message: "Execution Error: \n"+ex.toString() }
		}

		if (refProcess != null)
			refProcess[0] = pro;
		
		if (dontwait != true)
		{
			pro.wait();
			if (output != null && exit == 0)
			{
				return out;
			}
			else
				throw { code: exit, cause: null, message: err, out: out};
		}
	},
	
	msgboxOK: 0,
	msgboxERR: 1,
	msgboxOKCAN: 2,
	msgboxYESNO: 3,
	msgboxINPUT: 4,
	msgboxPASSWD: 5,
	msgboxSELECT: 6,
	msgboxCHKBX: 7,
	msgboxMULTILINE: 8,
	
	msgBox: function(type, title, message, options)
	{
		var prompt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

		var out = {};
		var out2 = {};
		
		switch (type)
		{
			case this.msgboxOK:
			case this.msgboxERR:
				prompt.alert(null, title, message);
				return;
				
			case this.msgboxOKCAN:
				return prompt.confirm(null, title, message);
				
			case this.msgboxYESNO:
				return (prompt.confirmEx(null, title, message, prompt.STD_YES_NO_BUTTONS, null, null, null, null, out2)==0);
				
			case this.msgboxINPUT:
				if (prompt.prompt(null, title, message, out, null, out2))
					return out.value;
				else
					return null;
				
			case this.msgboxMULTILINE:
				 options.window.openDialog("chrome://otpmail/content/multiline.xul", "otpDialog", "centerscreen,chrome,close,titlebar,modal", title, message, out, options.text)
				 return out.value;

			case this.msgboxPASSWD:
				if (prompt.promptPassword(null, title, message, out, null, out2))
					return out.value;
				else
					return null;
			
			case this.msgboxSELECT:
				if (prompt.select(null, title, message, options.length, options, out))
					return out.value;
				else
					return null;

			case this.msgboxCHKBX:
				var check = {value: false};
				prompt.alertCheck(null, title, message, options, check);
				return check.value;
		}
	},
	
	// based on Enigmail enigmailCommon.jsm / getFrame / 616
	getFrame:	function(win, frameName)
	{
		for (var j=0; j<win.frames.length; j++)
		{
			if (win.frames[j].name == frameName)
			{
				return win.frames[j];
			}
		}
		return null;
	}
}