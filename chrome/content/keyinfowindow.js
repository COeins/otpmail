/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

	Components.utils.import("chrome://otpmail/content/otpcommon.js");

	function infoLoad()
	{
		try
		{
			var info = otpCommon.manageKey("--key-info");
			document.getElementById('infoText').value = info;
		}
		catch (ex)
		{
			if (ex.code > 0)
				alert("Error:\n"+otpCommon.printr(ex));
			window.close();
		}
	}
