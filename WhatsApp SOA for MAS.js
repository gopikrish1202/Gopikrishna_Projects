function WhatsAppSOAMAS() {
    var context = nlapiGetContext();
    var isRescheduled = false;
    // Retrieve the parameter value using the script context
    var whatsInternalID = context.getSetting('SCRIPT', 'custscript_whatsapp_soa_mas_params');
    // nlapiLogExecution("debug", "whatsUISubsidiary", JSON.stringify(whatsInternalID));

    var whatsUIRec = nlapiLoadRecord('customrecord_cust_soa_whats_ui', whatsInternalID);
    var FromDate = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_from_date');
    var ToDate = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_to_date');
    var Subsidiary = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_subsidiary');
    var branch = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_branch');
    var sendWhatsApp = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_send_whatsapp');
    var whatsUICreatedUser = whatsUIRec.getFieldText('custrecord_cust_soa_wa_ui_created_user');
    var whatsFolder = whatsUIRec.getFieldValue('custrecord_cust_soa_wa_ui_folder_ref');
    var Branch = branch.split('\u0005');
    // nlapiLogExecution("DEBUG", "fromDate, toDate, Subsidiary, Branch, sendWhatsApp", [FromDate, ToDate, Subsidiary, Branch, sendWhatsApp]);
    // var FromDate = nlapiDateToString(fromDate);
    // var ToDate = nlapiDateToString(toDate);
    // nlapiLogExecution("DEBUG", "FromDate, ToDate", [FromDate, ToDate]);

    // var dateRange = getDateRange();
    // var thisMonthStartDate = dateRange.curMonthStartDate;
    // var thisMonthLastDate = dateRange.curMonthLastDate;
    // nlapiLogExecution("debug", "thisMonthStartDate", thisMonthStartDate);
    // nlapiLogExecution("debug", "thisMonthLastDate", thisMonthLastDate);

    var today = new Date();
    var todayFormatted = formatDateDDMMYYYY(today);
    // nlapiLogExecution("debug", "todayFormatted", todayFormatted);

    // STEP 1: Customer Balance for SOA (for getting Open Balance Customer)
    var customerSearch = nlapiSearchRecord("transaction", null,
        [
            ["type", "anyof", "CustCred", "CustRfnd", "CustInvc", "Journal", "CustPymt"],
            "AND",
            ["mainline", "is", "T"],
            "AND",
            ["customer.balance", "greaterthan", "0.00"],
            "AND",
            ["trandate", "within", FromDate, ToDate],
            "AND",
            ["subsidiary", "anyof", Subsidiary],
            "AND",
            ["location", "anyof", Branch], // Assuming branch[0] is the first branch value
            "AND",
            ["custbody_sub_customer", "noneof", "@NONE@"],
            "AND",
            ["customer.custentity_whats_soa_send_date", "notwithin", todayFormatted, todayFormatted]
        ],
        [
            new nlobjSearchColumn('entity', null, 'group'),
            new nlobjSearchColumn('internalid', 'customer', 'group')
        ]
    );
    // nlapiLogExecution("debug", "customerSearch.length", customerSearch.length);
    // var subsidiaryArr = []; // 5 - SM Parts, 10 - MAS Pars
    // subsidiaryArr.push(susidiary);
    // nlapiLogExecution("debug", "subsidiaryArr", subsidiaryArr);
    if (customerSearch && customerSearch.length > 0) {
        // nlapiLogExecution("debug", "Open Balance Customers Length", customerSearch.length);
        for (var i = 0; i < customerSearch.length; i++) { // limit first 100 or full length (customerSearch.length)
            var customerResult = customerSearch[i];
            var whatsStatus = false;
            // nlapiLogExecution("debug", "customerResult", customerResult);

            var custIntID = customerResult.getValue('internalid', 'customer', 'group'); // Get Customer Internal ID
            var custName = customerResult.getValue('entity', null, 'group'); // Get Customer Internal ID
            //nlapiLogExecution("debug", "custIntID, custName", [custIntID, custName]);
            // if (custIntID == "2002") { // Customer InternalID Hardcoded.
            // for (var m = 0; m < subsidiaryArr.length; m++) { // Subsidiary Array Loop
            //     var Subsidiary = subsidiaryArr[m];
            // nlapiLogExecution("debug", "Subsidiary", Subsidiary);

            // STEP 2: Get Sub Customer SOA (Get Sub Customer List from Parent Customer)
            var subCustomerSearch = nlapiSearchRecord("customer", null,
                [
                    ["internalidnumber", "equalto", custIntID] // Customer Internal ID Passed into Search Criteria
                ],
                [
                    new nlobjSearchColumn("name", "CUSTRECORD_PARENT_CUSTOMER", null),
                    new nlobjSearchColumn("internalid", "CUSTRECORD_PARENT_CUSTOMER", null)
                ]
            );

            // nlapiLogExecution("debug", "subCustomerSearch.length", subCustomerSearch.length);
            if (subCustomerSearch && subCustomerSearch.length > 0) {
                for (var j = 0; j < subCustomerSearch.length; j++) {
                    var subCustomerResult = subCustomerSearch[j];
                    // nlapiLogExecution("debug", "subCustomerResult[j]", JSON.stringify(subCustomerResult));
                    var subCustName = subCustomerResult.getValue("name", "CUSTRECORD_PARENT_CUSTOMER", null);
                    var subCustIntID = subCustomerResult.getValue("internalid", "CUSTRECORD_PARENT_CUSTOMER", null);
                    nlapiLogExecution("debug", "[custIntID, subCustName, subCustIntID]", JSON.stringify([custIntID, subCustName, subCustIntID]));

                    // STEP 3: Customer Transaction Search SOA (Sub Customer Transactions Wise Location Grouped).
                    // var locArr = getLocation(FromDate, ToDate, custIntID, subCustIntID, Subsidiary); // locArr [Single Branch and Couple of Branches]
                    // nlapiLogExecution('debug', 'locArr', locArr);
                    for (var k = 0; k < Branch.length; k++) {
                        var Location = Branch[k];
                        // nlapiLogExecution("debug", "Location, Branch.length, Branch.indexOf(Location)", [Location, Branch.length, Branch.indexOf(Location)] );
                        if (Branch.length > 0 && Branch.indexOf(Location) > -1) {
                            // nlapiLogExecution("debug", "Location condition satisfied", [Location, Branch.indexOf(Location)] );
                            whatsStatus = SOAprint(FromDate, ToDate, custIntID, subCustIntID, Subsidiary, Location);
                            //nlapiLogExecution("DEBUG", "whatsStatus", whatsStatus);
                        } else if (Branch.length < 1) { // if (Branch.length <= 1) Space Occurs in Branch so, length is 1
                            // nlapiLogExecution("debug", "Location condition failed", [Location, Branch.indexOf(Location)] );
                            whatsStatus = SOAprint(FromDate, ToDate, custIntID, subCustIntID, Subsidiary, Location);
                            //nlapiLogExecution("DEBUG", "whatsStatus", whatsStatus);
                        }
                    }

                    if (whatsStatus) {
                        var subCustLoadsetDate = nlapiLoadRecord("customrecord_sub_customer_list", subCustIntID);
                        // nlapiLogExecution("debug", "sub Customer Record WhatsApp SOA Send Date", subCustLoad);
                        subCustLoadsetDate.setFieldValue("custrecord_monthly_stmt_snd_dt_", new Date()); //sets the monthly statement sent date in sub customer master.
                        var subCustSaved = nlapiSubmitRecord(subCustLoadsetDate, true, true);
                        // nlapiLogExecution("debug", "Sub Customer Name and ID WhatsApp Send Date Set", JSON.stringify([subCustName, subCustSaved]));
                    }
                    // break;

                    if (nlapiGetContext().getRemainingUsage() < 200) {
                        // nlapiLogExecution("debug", "yeidling script", nlapiGetContext().getRemainingUsage());
                        var status = nlapiScheduleScript(
                            'customscript_whatsapp_soa_mas',
                            'customdeploy_whatsapp_soa_mas',
                            {
                                custscript_whatsapp_soa_mas_params: whatsInternalID,
                            }
                        );
                        nlapiLogExecution("debug", "Rescheduled Script Status", status);
                        isRescheduled = true;
                        return;
                        // nlapiYieldScript(); // Yield script after processing the batch
                    }
                }
            }
            // break;
            // } // customer If Condition
            // break;
            //if (whatsStatus) {
            var CustLoadsetDate = nlapiLoadRecord("customer", custIntID);
            // nlapiLogExecution("debug", "sub Customer Record WhatsApp SOA Send Date", subCustLoad);
            CustLoadsetDate.setFieldValue("custentity_whats_soa_send_date", new Date()); //sets the monthly statement sent date in sub customer master.
            var custSaved = nlapiSubmitRecord(CustLoadsetDate, true, true);
            //nlapiLogExecution("debug", "Customer Name and ID WhatsApp Send Date Set", JSON.stringify([custName, custSaved]));
            // }
            // }
        }

        if (!isRescheduled) {

            nlapiLogExecution("debug", "All SOA Process Completed");

            var mainRec = nlapiLoadRecord("customrecord_cust_soa_whats_ui", whatsInternalID);

            mainRec.setFieldValue("custrecord_cust_soa_wa_ui_to_status", "COMPLETE");

            nlapiSubmitRecord(mainRec, true, true);

            nlapiLogExecution("debug", "Main Record Marked Completed");

        }
    }

    function getLocation(FromDate, ToDate, Customer, SubCustomer, Subsidiary) {
        try {
            var locArr = [];
            var filters = [
                ["type", "anyof", "Journal", "CustPymt", "CustCred", "CustInvc", "CustRfnd"],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["trandate", "within", FromDate, ToDate],
                "AND",
                ["subsidiary", "anyof", Subsidiary], // ["subsidiary","anyof","10","5"],
                "AND",
                ["name", "anyof", Customer],
                "AND",
                [["custbody_sub_customer", "anyof", SubCustomer]], // ["custcol_sm_sub_cust", "anyof", SubCustomer], "OR", 
            ];
            var transactionSearch = nlapiSearchRecord("transaction", null,
                filters,
                [
                    new nlobjSearchColumn("locationnohierarchy", null, "GROUP"),
                    new nlobjSearchColumn("internalid", "location", "GROUP"),
                    new nlobjSearchColumn("subsidiarynohierarchy", null, "GROUP"),
                    new nlobjSearchColumn("internalid", "subsidiary", "GROUP")
                ]
            );
            // nlapiLogExecution("debug", "transactionSearch.length", JSON.stringify(transactionSearch));
            if (transactionSearch && transactionSearch.length > 0) {
                for (var i = 0; i < transactionSearch.length; i++) {
                    var locResult = transactionSearch[i];
                    var loc = locResult.getValue("internalid", "location", "GROUP");
                    locArr.push(loc);
                }
            }
            return locArr;
        } catch (error) {
            //nlapiLogExecution("debug", "error in getLocation", error.message);
        }
    }

    // function convertToDate(dateString) {
    //     var parsedDate = format.parse({
    //         value: dateString,
    //         type: format.Type.DATE
    //     });
    //     log.debug('Parsed Date:', parsedDate);
    //     return parsedDate;
    // }

    function getDateRange() {
        var currentDate = new Date();
        var year = currentDate.getFullYear();
        var month = currentDate.getMonth() - 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
        var fromDate = nlapiDateToString(new Date(year, month, 1));   // 01/03/2025
        var toDate = nlapiDateToString(new Date(year, month + 1, 0)); // 31/03/2025

        var curMonthStartDate = nlapiDateToString(new Date(year, month + 1, 1));
        var curMonthLastDate = nlapiDateToString(new Date(year, month + 2, 0));
        return { fromDate: fromDate, toDate: toDate, curMonthStartDate: curMonthStartDate, curMonthLastDate: curMonthLastDate };
    }

    function SOAprint(FromDate, ToDate, Customer, SubCustomer, Subsidiary, Location) {
        try {
            var soaStatus = false;
            var OpeningBalance = GetCustomerOpeningBalance1(Customer, FromDate, Location, SubCustomer, Subsidiary);
            //nlapiLogExecution("debug", "OpeningBalance", OpeningBalance);
            if (OpeningBalance != 0) {
                var TranDet = GetTransactionDetails(Customer, FromDate, Location, SubCustomer, ToDate, Subsidiary);
                var TranDetJV = GetTransactionDetailsJV(Customer, FromDate, Location, SubCustomer, ToDate, Subsidiary);
                var TranDetCF = GetTransactionDetailsCF(Customer, FromDate, Location, SubCustomer, ToDate, Subsidiary);

                var CreditTotal = 0;
                var DebitTotal = 0;
                var Head = "<head>\n";
                var language = "<link name=\"NotoSans\" type=\"font\" subtype=\"truetype\" src=\"${nsfont.NotoSans_Regular}\" src-bold=\"${nsfont.NotoSans_Bold}\" src-italic=\"${nsfont.NotoSans_Italic}\" src-bolditalic=\"${nsfont.NotoSans_BoldItalic}\" bytes=\"2\" />";;
                language += "<link name=\"NotoSans\" type=\"font\" subtype=\"truetype\" src=\"${nsfont.NotoSans_Regular}\" src-bold=\"${nsfont.NotoSans_Bold}\" src-italic=\"${nsfont.NotoSans_Italic}\" src-bolditalic=\"${nsfont.NotoSans_BoldItalic}\" bytes=\"2\" />";
                language += "<#if .locale == \"zh_CN\">";
                language += "        <link name=\"NotoSansCJKsc\" type=\"font\" subtype=\"opentype\" src=\"${nsfont.NotoSansCJKsc_Regular}\" src-bold=\"${nsfont.NotoSansCJKsc_Bold}\" bytes=\"2\" />";
                language += "    <#elseif .locale == \"zh_TW\">";
                language += "        <link name=\"NotoSansCJKtc\" type=\"font\" subtype=\"opentype\" src=\"${nsfont.NotoSansCJKtc_Regular}\" src-bold=\"${nsfont.NotoSansCJKtc_Bold}\" bytes=\"2\" />";
                language += "    <#elseif .locale == \"ja_JP\">";
                language += "        <link name=\"NotoSansCJKjp\" type=\"font\" subtype=\"opentype\" src=\"${nsfont.NotoSansCJKjp_Regular}\" src-bold=\"${nsfont.NotoSansCJKjp_Bold}\" bytes=\"2\" />";
                language += "    <#elseif .locale == \"ko_KR\">";
                language += "        <link name=\"NotoSansCJKkr\" type=\"font\" subtype=\"opentype\" src=\"${nsfont.NotoSansCJKkr_Regular}\" src-bold=\"${nsfont.NotoSansCJKkr_Bold}\" bytes=\"2\" />";
                language += "    <#elseif .locale == \"th_TH\">";
                language += "        <link name=\"NotoSansThai\" type=\"font\" subtype=\"opentype\" src=\"${nsfont.NotoSansThai_Regular}\" src-bold=\"${nsfont.NotoSansThai_Bold}\" bytes=\"2\" />";
                language += "    </#if> ";

                var loadsubsidiary = nlapiLoadRecord("subsidiary", Subsidiary);
                var SubsidiaryAddress = loadsubsidiary.getFieldValue('mainaddress_text');
                var cin = loadsubsidiary.getFieldValue('custrecord_sm_cin_no');
                var subname = loadsubsidiary.getFieldText('parent').replace(/&(?!apos;)/g, "&amp;");
                var subsidiaryname = subname.split(":")[0].trim();
                var companyname = subname.split(":")[1] ? subname.split(":")[1].trim() : subname.trim();
                var phonenumber = loadsubsidiary.getFieldText('custrecord_in_mobile_number');
                var loadlocation = nlapiLoadRecord("location", Location);
                var LocationAddress = loadlocation.getFieldValue('mainaddress_text');
                var locaddress;
                if (LocationAddress) {
                    locaddress = LocationAddress.replace(/&(?!apos;)/g, "&amp;");
                    // nlapiLogExecution("debug", "locaddress", locaddress);
                }

                var macro = "<macrolist>";
                macro += "<macro id=\"nlheader\">";
                macro += "<table style=\"width: 100%;font-size:10px;font-family: NotoSans, NotoSansCJKsc, sans-serif;\"> ";
                macro += " <tr style=\"width: 100%;\">";
                macro += "<td style=\"width:75%;align:center\">" + (subsidiaryname ? subsidiaryname : "") + "<br /></td>";
                macro += "</tr>";
                macro += " <tr style=\"width: 100%;\">";
                macro += "<td style=\"width:75%;align:center\">" + (companyname ? companyname : "") + "<br /></td>";
                macro += "</tr>";
                macro += "<tr>";
                macro += "<td style=\"width: 75%;align:center\">" + (locaddress ? locaddress : "") + "</td>";
                macro += "</tr>";
                if (phonenumber) {
                    macro += "<tr>";
                    macro += "<td style=\"width: 75%;align:center\">Phone:" + (phonenumber ? phonenumber : "") + "</td>";
                    macro += "</tr>";
                }
                macro += "</table>";
                macro += "</macro>";
                macro += "<macro id=\"nlfooter\">";
                macro += "<table style = \"width:100%;font-family: NotoSans, NotoSansCJKsc, sans-serif;\">";
                macro += "<tr><td style=\"align:center;font-size:8px\"></td></tr>";
                macro += "<tr><td style=\"align:right\"><pagenumber/> of <totalpages/></td></tr>";
                macro += "</table>";
                macro += "</macro>";
                macro += "</macrolist>";

                var styling = "<style type=\"text/css\">\n";
                styling += "table {";
                styling += "font-size: 10pt;";
                styling += "table-layout: fixed;";
                //styling += "page-break-inside: avoid;";
                styling += "width: 100%;"; // Ensure full width
                styling += "}";
                styling += "th {";
                styling += "font-weight: bold;";
                styling += "font-size: 10pt;";
                styling += "vertical-align: middle;";
                styling += "padding: 5px 6px 3px;";
                styling += "background-color: #e3e3e3;";
                styling += "color: #333333;";
                styling += "}";
                styling += "td {";
                styling += "padding: 6px 2px;";
                styling += "}";
                styling += "td p { align: left; }";
                styling += "tr {";
                styling += "page-break-inside: avoid;"; // Avoid breaks inside rows
                styling += "}";
                styling += ".content-table {";
                styling += "max-height: 90%;"; // Limit table height for pagination control
                styling += "}";
                styling += "</style>\n";
                Head += macro + styling;
                Head += "</head>\n";

                var Body = "<body header=\"nlheader\" header-height=\"8%\" footer=\"nlfooter\" footer-height=\"20pt\" padding=\"0.2in 0.5in 0.2in 0.5in\" size=\"letter\">\n";

                var table2 = "<table  style=\"width: 100%;font-size:15px \">";
                table2 += "<tr>";
                table2 += "<td style=\"width: 20%;align:center;\"><b>Customer Statement of Account From " + FromDate + " To " + ToDate + "</b></td>";
                table2 += "</tr>";
                table2 += "</table><br/>";

                var CustName = nlapiLookupField('customer', Customer, 'companyname').replace(/&(?!apos;)/g, "&amp;");
                var subCustName = nlapiLookupField('customrecord_sub_customer_list', SubCustomer, 'name').replace(/&(?!apos;)/g, "&amp;");
                var todate = new Date();
                var dd = todate.getDate();
                var MM = todate.getMonth() + 1; // Months are zero-based
                var YYYY = todate.getFullYear();
                var formattedDate = dd + '/' + MM + '/' + YYYY;

                var results = searchSubCustomerList(Customer, subCustName);
                var combinedAddress;
                if (results.length > 0) {
                    for (var i = 0; i < results.length; i++) {
                        var result = results[i];
                        // nlapiLogExecution("DEBUG", "Result " + (i + 1), JSON.stringify(result));
                        var fullAddress = escapeXml(result.address || "");  // Main address
                        var address1 = escapeXml(result.address1 || "");    // Address line 1
                        var address2 = escapeXml(result.address2 || "");    // Address line 2
                        var city = escapeXml(result.city || "");            // City
                        var state = escapeXml(result.state || "");          // State
                        var pin = escapeXml(result.pin || "");              // PIN code

                        // Combine them into a full address while skipping empty components
                        var addressParts = [fullAddress, address1, address2, city, state];
                        combinedAddress = addressParts.filter(function (part) {
                            return part && part.trim(); // Include only non-empty parts
                        }).join(", ");
                        if (pin) {
                            combinedAddress += " - " + pin;
                        }
                        // nlapiLogExecution("DEBUG", "Address for Result " + (i + 1), combinedAddress);
                    }
                }

                var table1 = "<table  style=\"width: 100%; \">";
                table1 += "<tr>";
                table1 += "<td style=\"width: 60%;\">" + (CustName ? CustName : "") + "</td>";
                table1 += "<td style=\"width:40%\"><b>Date: </b>" + formattedDate + "</td>";
                table1 += "</tr>";
                if (combinedAddress) {
                    table1 += "<tr>";
                    table1 += "<td style=\"width: 60%;\">" + (combinedAddress ? combinedAddress : "") + "</td>";
                    table1 += "<td style=\"width: 40%\"><b>Total Pages: </b><totalpages/></td>";
                    table1 += "</tr>";
                }

                table1 += "<tr>";
                table1 += "<td style=\"width: 60%;\"></td>";
                table1 += "<td style=\"width: 40%\"><b>Party Code :</b>" + (subCustName ? subCustName : "") + "</td>";
                table1 += "</tr>";
                table1 += "</table>";

                var table8 = "<table  style=\"width: 100%; \">";
                table8 += "<thead>";
                table8 += "<tr>";
                table8 += "<th style=\"width: 19%; border-left: 1px; border-right: 1px; border-bottom: 1px; border-top: 1px;\"><b>Document No.</b></th>";
                table8 += "<th style=\"width: 13%; border-right: 1px; border-bottom : 1px; border-top: 1px;\"><b>Date</b></th>";
                table8 += "<th style=\"width: 13%; border-right: 1px; border-bottom : 1px; border-top: 1px;\"><b>Type</b></th>";
                table8 += "<th style=\"width: 15%; border-right: 1px; border-bottom : 1px; border-top: 1px;\"><b>Memo</b></th>";
                // table8 += "<td style=\"width: 10%; border-right: 1px; border-bottom : 1px; border-top: 1px;\"><b>Status</b></td>";
                table8 += "<th style=\"width: 20%; border-right: 1px; border-bottom : 1px; border-top: 1px;\"><b>Debit</b></th>";
                table8 += "<th style=\"width: 20%; border-right: 1px; border-bottom: 1px; border-top: 1px;\"><b>Credit</b></th>";
                table8 += "</tr>";
                table8 += "</thead>";
                table8 += "<tr>";
                table8 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\"><b>Opening Balance</b></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px; \"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px; align:right;\">" + (OpeningBalance > 0 ? OpeningBalance.toFixed(2) : "0.00") + "</td>";
                table8 += "<td  style=\" border-right: 1px; border-bottom: 1px;align:right;\">" + (OpeningBalance < 0 ? Math.abs(OpeningBalance).toFixed(2) : "0.00") + "</td>";
                table8 += "</tr>";

                var lastTranId = '';
                var tr1 = '';
                var tr2 = '';
                var tr3 = '';
                if (TranDet && TranDet.length > 0) {
                    for (var i = 0; i < TranDet.length; i++) {
                        var tranid = TranDet[i].getValue('tranid');
                        // var amount = TranDet[i].getValue('amount');
                        var documentno = TranDet[i].getValue('custbody_sm_ori_docu_no');
                        // If the current tranid is the same as the last one, skip the row
                        if (tranid === lastTranId) {
                            continue;  // Skip this iteration, hence the row won't be added to the table
                        }
                        // Update lastTranId for the next iteration
                        lastTranId = tranid;
                        tr1 += "<tr>";
                        // Print the Document No.
                        tr1 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\">" + (documentno ? documentno : tranid) + "</td>";

                        // Add the rest of the columns for the current transaction
                        tr1 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDet[i].getValue('trandate') + "</td>";
                        tr1 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDet[i].getText('custbody_cardtype') + "</td>";
                        tr1 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + escapeXml(TranDet[i].getValue('memo')) + "</td>";

                        var TranType = TranDet[i].getText('type');
                        var status = TranDet[i].getValue('status');
                        var drAmt = 0;
                        var crAmt = 0;
                        if (TranType == "Invoice") {
                            drAmt = parseFloat("0" + TranDet[i].getValue('amount'));
                            DebitTotal = DebitTotal + drAmt;
                            var A = "Invoice";
                        }
                        if (TranType == "Receipt") {
                            crAmt = parseFloat("0" + TranDet[i].getValue('amount'));
                            CreditTotal = CreditTotal + crAmt;
                            var B = "Payment"

                        }
                        if (TranType == "Journal") {
                            var journalid = TranDet[i].getValue('internalid');
                            var loadjournal = nlapiLoadRecord('journalentry', journalid);
                            var linecount = loadjournal.getLineItemCount('line');
                            var C = "Journal Entry";

                            for (var j = 1; j <= linecount; j++) {
                                var acctype = loadjournal.getLineItemValue('line', 'accounttype', j);  // Get the account type
                                var entityid = loadjournal.getLineItemValue('line', 'entity', j);      // Get the entity (customer or otherwise)

                                // Only check if account type is AcctRec (Accounts Receivable) and ensure it's a debit
                                if (acctype == 'AcctRec') {
                                    var debitAmt = parseFloat(loadjournal.getLineItemValue('line', 'debit', j)) || 0;
                                    var creditAmt = parseFloat(loadjournal.getLineItemValue('line', 'credit', j)) || 0;

                                    if (debitAmt > 0 && entityid == CustID) {  // Only show debit amounts for the given customer
                                        drAmt = debitAmt;  // Store the debit amount only for AcctRec
                                        DebitTotal += drAmt;  // Add to the DebitTotal
                                    }
                                    if (creditAmt > 0 && entityid == CustID) {  // Only show credit amounts for the given customer
                                        crAmt = creditAmt;  // Store the credit amount only for AcctRec
                                        CreditTotal += crAmt;  // Add to the CreditTotal
                                    }
                                }
                            }
                        }

                        if (TranType.replace(/\s+/g, '').toLowerCase() == "creditmemo") {
                            crAmt = TranDet[i].getValue('amount');
                            crAmt = crAmt.replace("-", "");
                            crAmt = Math.abs(parseFloat(crAmt));
                            CreditTotal = CreditTotal + crAmt;
                        }

                        /*table8 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\"> " + status + "</td>";*/
                        tr1 += "<td style=\" border-right: 1px; border-bottom : 1px; align:right;\">" + drAmt.toFixed(2) + "</td>";
                        tr1 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\">" + crAmt.toFixed(2) + "</td>";
                        tr1 += "</tr>";
                    }
                }

                if (TranDetCF && TranDetCF.length > 0) {
                    for (var i = 0; i < TranDetCF.length; i++) {
                        // Ensure the current item is not null or undefined
                        if (!TranDetCF[i]) {
                            continue;  // Skip the iteration if the current element is null/undefined
                        }
                        // Get the current tranid (Document No.)
                        var tranid = TranDetCF[i].getValue('transactionnumber');
                        var documentno = TranDetCF[i].getValue('custbody_sm_ori_docu_no');
                        // If the current tranid is the same as the last one, skip the row
                        if (tranid === lastTranId) {
                            continue;  // Skip this iteration, hence the row won't be added to the table
                        }
                        // Update lastTranId for the next iteration
                        lastTranId = tranid;
                        tr2 += "<tr>";
                        tr2 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\">" + (documentno ? documentno : tranid) + "</td>";
                        tr2 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDetCF[i].getValue('trandate') + "</td>";
                        tr2 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDetCF[i].getText('custbody_cardtype') + "</td>";
                        var memoValue = '';
                        if (TranDetCF[i]) {
                            memoValue = escapeXml(TranDetCF[i].getValue('memo') || ''); // Fallback to empty string if memo is null/undefined
                        }
                        tr2 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + memoValue + "</td>";
                        var TranType = TranDetCF[i].getText('type');
                        var status = TranDetCF[i].getValue('status');
                        var drAmt = 0;
                        var crAmt = 0;
                        if (TranType.replace(/\s+/g, '').toLowerCase() == "customerrefund") {
                            drAmt = TranDetCF[i].getValue('total');
                            drAmt = Math.abs(drAmt);
                            drAmt = parseFloat(drAmt);
                            DebitTotal = DebitTotal + drAmt;
                        }
                        // nlapiLogExecution('debug', "drAmt", drAmt)
                        /*tr2 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\"> " + status + "</td>";*/
                        tr2 += "<td style=\" border-right: 1px; border-bottom : 1px; align:right;\">" + drAmt.toFixed(2) + "</td>";
                        tr2 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\">" + crAmt.toFixed(2) + "</td>";
                        tr2 += "</tr>";
                    }
                }

                if (TranDetJV && TranDetJV.length > 0) {
                    // nlapiLogExecution('debug', 'TranDetJV Total -' + TranDetJV.length);
                    for (var i = 0; i < TranDetJV.length; i++) {
                        var tranid = TranDetJV[i].getValue('tranid');
                        var documentno = TranDetJV[i].getValue('custbody_sm_ori_docu_no');
                        // Get the account type
                        var accountType = TranDetJV[i].getValue('accounttype');
                        // Process only rows where the account type is "Accounts Receivable"
                        if (accountType !== "Accounts Receivable") {
                            continue; // Skip rows that are not "Accounts Receivable"
                        }
                        // If the current tranid is the same as the last one, skip the row
                        // if (tranid === lastTranId) {
                        //    continue;  // Skip this iteration, hence the row won't be added to the table
                        //  }

                        // Update lastTranId for the next iteration
                        lastTranId = tranid;

                        tr3 += "<tr>";
                        // Print the Document No.
                        tr3 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\">" + (documentno ? documentno : tranid) + "</td>";

                        // Add the rest of the columns for the current transaction
                        tr3 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDetJV[i].getValue('trandate') + "</td>";
                        tr3 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + TranDetJV[i].getText('custbody_cardtype') + "</td>";
                        tr3 += "<td style=\" border-right: 1px; border-bottom : 1px;\">" + escapeXml(TranDetJV[i].getValue('memo')) + "</td>";
                        // Handle credit amount
                        crAmt = TranDetJV[i].getValue('creditamount');
                        if (crAmt && !isNaN(crAmt)) {
                            crAmt = crAmt.replace("-", "");
                            crAmt = parseFloat(crAmt);
                            CreditTotal = CreditTotal + crAmt;
                        } else {
                            crAmt = 0;  // Default to 0 if it's "NA" or invalid
                        }

                        // Handle debit amount
                        drAmt = TranDetJV[i].getValue('debitamount');
                        if (drAmt && !isNaN(drAmt)) {
                            drAmt = drAmt.replace("-", "");
                            drAmt = parseFloat(drAmt);
                            DebitTotal = DebitTotal + drAmt;
                        } else {
                            drAmt = 0;  // Default to 0 if it's "NA" or invalid
                        }

                        // Add debit and credit amounts to the table
                        tr3 += "<td style=\" border-right: 1px; border-bottom : 1px; align:right;\">" + drAmt.toFixed(2) + "</td>";
                        tr3 += "<td style=\" border-right: 1px; border-bottom : 1px; align:right;\">" + crAmt.toFixed(2) + "</td>";
                        tr3 += "</tr>";
                    }
                }

                var rows = [tr1, tr2, tr3];

                rows.sort(function (a, b) {
                    var dateA, dateB;

                    try {
                        var dateStrA = a.match(/\d{2}\/\d{2}\/\d{4}/)[0]; // Extract date
                        var partsA = dateStrA.split('/');
                        dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]); // Convert to Date object
                    } catch (error) {
                        dateA = new Date(0); // Set to the earliest date (Unix epoch start)
                    }

                    try {
                        var dateStrB = b.match(/\d{2}\/\d{2}\/\d{4}/)[0];
                        var partsB = dateStrB.split('/');
                        dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
                    } catch (error) {
                        dateB = new Date(0);
                    }

                    return dateA - dateB;
                });

                // Ensure DebitFinal is a number and not undefined or null before using toFixed
                if (OpeningBalance > 0) {
                    var DebitFinal = parseFloat(OpeningBalance + DebitTotal);
                    // nlapiLogExecution('debug', 'DebitFinal', DebitFinal.toFixed(2));
                }

                if (OpeningBalance < 0) {
                    var CreditFinal = parseFloat(Math.abs(OpeningBalance) + CreditTotal);
                    // nlapiLogExecution('debug', 'CreditFinal', CreditFinal.toFixed(2));
                }

                table8 += rows.join('');
                table8 += "<tr>";
                table8 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\"><b>Total</b></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                // table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\">" + (OpeningBalance > 0 ? (OpeningBalance + DebitTotal).toFixed(2) : DebitTotal) + "</td>";
                table8 += "<td style=\" border-right: 1px; border-bottom: 1px;align:right;\">" + (OpeningBalance < 0 ? (Math.abs(OpeningBalance) + CreditTotal).toFixed(2) : CreditTotal) + "</td>";
                table8 += "</tr>";

                var ClosingBalance = parseFloat(OpeningBalance + DebitTotal - CreditTotal);
                // var ClosingBalance = parseFloat(DebitFinal - CreditFinal);
                table8 += "<tr>";
                table8 += "<td style=\" border-left: 1px; border-right: 1px; border-bottom: 1px;\"><b>Closing Balance</b></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                // table8 += "<td style=\" border-right: 1px; border-bottom : 1px;\"></td>";
                table8 += "<td style=\" border-right: 1px; border-bottom : 1px;align:right;\">" + (ClosingBalance > 0 ? ClosingBalance.toFixed(2) : "0.00") + "</td>";
                table8 += "<td  style=\" border-right: 1px; border-bottom: 1px;align:right;\">" + (ClosingBalance < 0 ? Math.abs(ClosingBalance).toFixed(2) : "0.00") + "</td>";
                table8 += "</tr>";

                table8 += "</table>";

                var table9 = "<table style=\"width: 100%;margin-top:20px\">";
                table9 += "<tr>";
                table9 += "<td style=\"width:100%;align:left;font-size:10px\"><b> THIS IS A COMPUTERISED STATEMENT : HENCE NOT SIGNED </b></td>";
                table9 += "</tr>";
                table9 += "</table>";
                var table10 = ""; // Initialize to avoid undefined

                if (Subsidiary == "5" || Subsidiary == "10") {
                    table10 += "<table style='width: 100%;'>";
                    table10 += "<tr>";
                    table10 += "<td style='width: 50%; text-align: left; font-size: 10px;'>"
                    table10 += "<b>TERMS: THIS CREDIT ACCOUNT HAS BEEN OPENED ON TERMS OF SETTLEMENT BY THE END OF THE FOLLOWING MONTH. ACCORDING TO THE CURRENT POLICY, OUR BILLS COVERING THE PURCHASE OF THE MONTH ARE TO BE PAID IN FULL ON OR BEFORE THE END OF THE FOLLOWING MONTH, FAILING WHICH INTEREST WILL BE CHARGED ON THE AMOUNT OUTSTANDING AT 12% P.A. FROM THE DATE OF THE BILL.</b>";
                    table10 += "</td>";
                    table10 += "</tr>";
                    table10 += "</table>";
                }
                var table11 = "<table style=\"width: 100%;\">";
                table11 += "<tr>";
                table11 += "<td style=\"width:70%;align:left;font-size:11px\"><b> Legend</b> :CustInv - Invoice, CustPymt - Customer Payment, Journal - Journal Entry</td>";
                table11 += "<td style=\"width:30%\"></td>";
                table11 += "</tr>";
                table11 += "</table>";

                var table12 = "<table style=\"width: 100%;\">";
                table12 += "<tr>";
                table12 += "<td style=\"width:100%;align:left;font-size:11px\"> E.and O. E. Regd. Office : Trichur Sundaram Santhanam and Family Private Limited,67,Chamiers Road, R.A.Puram, Chennai600028</td>";
                table12 += "</tr>";
                table12 += "</table>";

                var table13 = "<table style=\"width: 100%;\">";
                table13 += "<tr>";
                table13 += "<td style=\"width:100%;align:center;font-size:11px\">" + (cin ? cin : "") + "</td>";
                table13 += "</tr>";
                table13 += "</table>";

                Body += table2 + table1 + table8 + table9 + table10 + table11 + table12 + table13;
                Body += "</body>\n";

                // build up BFO-compliant XML using well-formed HTML	
                var xml = "<?xml version=\"1.0\"?>\n<!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">\n";
                //xml += "<pdf>\n<body font-size=\"12\">\n<h3>FeesStatement</h3>\n";
                xml += "<pdf>\n";
                xml += Head + Body;
                xml += "</pdf>";
                // run the BFO library to convert the xml document to a PDF 	
                var file = nlapiXMLToPDF(xml);
                var fileName = "";
                if (sendWhatsApp == 'T') {
                    fileName = subCustName + "_whatsapp_soa_" + FromDate + "-" + ToDate + ".pdf";
                } else {
                    fileName = subCustName + "_soa_" + FromDate + "-" + ToDate + ".pdf";
                }
                var pdfFile = nlapiCreateFile(fileName, 'PDF', file.getValue());

                var parts = FromDate.split('/');
                var currentDate = new Date(parseInt(parts[2]), parseInt(parts[1]), parseInt(parts[0])); // Year - Month - Day
                currentDate.setMonth(currentDate.getMonth() - 1);
                var year = currentDate.getFullYear(); // YYYY format
                var monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                var month = monthNames[currentDate.getMonth()]; // 3-letter month format
                var folderName = month + ' ' + year; // "MMM YYYY"

                // Parent Folder ID  Nav :- Documents -> Files -> File Cabinet -> 
                var subsName = "";
                var parentFolderId;
                if (sendWhatsApp == 'T') {
                    if (Subsidiary == '5') {
                        parentFolderId = 1632; // 1632	SM Parts - whatsapp soa
                        subsName = "SM Parts";
                    } else if (Subsidiary == '10') {
                        parentFolderId = 1633; // 1633	MAS Parts - whatsapp soa
                        subsName = "MAS Parts"
                    }
                } else {
                    parentFolderId = 2368;
                }

                // Get or create the folder
                var folderId = getOrCreateFolder(whatsUICreatedUser, parentFolderId, sendWhatsApp, folderName); // (folderName, parentFolderId, sendWhatsApp, whatsUICreatedUser);

                if (sendWhatsApp == 'F' && !whatsFolder) {
                    try {
                        nlapiLoadRecord('folder', folderId);
                        nlapiSubmitField(
                            'customrecord_cust_soa_whats_ui',        // Record type (e.g., 'customer', 'salesorder')
                            whatsInternalID,          // Internal ID of the record
                            'custrecord_cust_soa_wa_ui_folder_ref',      // Field(s) to update (string or array)
                            'https://9841153.app.netsuite.com/app/common/media/mediaitemfolders.nl?folder=' + folderId      // Value(s) to set (string or array)
                            // doSourcing   // Optional: true/false to trigger sourcing
                        );
                    } catch (error) {
                        nlapiLogExecution('debug', 'error in setFolderRef', error);
                    }
                }

                pdfFile.setFolder(folderId); // Replace with the internal ID of the folder where you want to save the file
                pdfFile.setIsOnline(true); // ** Without Login Netsuite User can Access Files **
                var fileId = nlapiSubmitFile(pdfFile);
                // nlapiLogExecution('debug', 'fileId', fileId);
                // write response to the client
                var savedFile = nlapiLoadFile(fileId);
                // Get the URL of the saved file
                var fileUrl = savedFile.getURL();
                // nlapiLogExecution('DEBUG', 'File URL', fileUrl);
                var header = "https://9841153.app.netsuite.com/";
                var fullUrl = header + fileUrl;
                nlapiLogExecution('debug', 'fullUrl', fullUrl);

                soaStatus = true;
                return soaStatus;

                var locArr = getLocationNameandCode(Location);
                // nlapiLogExecution("debug", "locArr", locArr);

                // if (sendWhatsApp == 'T') {
                //     var loadSubCustomer = nlapiLoadRecord("customrecord_sub_customer_list", SubCustomer);
                //     var custMobNo = loadSubCustomer.getFieldValue('custrecord_customer_phone');
                //     if (custMobNo) {
                //         custMobNo = custMobNo.trim();
                //         if (custMobNo.indexOf("+91") !== 0) {
                //             custMobNo = "+91" + custMobNo;
                //         }
                //     } else {
                //         nlapiLogExecution('ERROR', 'Customer Mobile Number is Empty', '');
                //     }

                //     // SEND SOA THROUGH WHATSAPP
                //     // if (Subsidiary == "10") {
                //     //     sendWhatappMessageMAS(fullUrl, custMobNo);
                //     // } else if (Subsidiary == "5") {
                //     //     sendWhatappMessageSM(fullUrl, custMobNo);
                //     // }

                //     // var custWhatsSOARec = nlapiCreateRecord('customrecord_cust_soa_report_whatsapp');
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_subsidiary', subsName);
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_sub_cust_code', subCustName);
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_sub_cust_name', CustName);
                //     // if (locArr.length > 0) {
                //     //     custWhatsSOARec.setFieldValue('custrecord_whats_soa_loc_code', locArr[0]);
                //     //     custWhatsSOARec.setFieldValue('custrecord_whats_soa_loc_name', locArr[1]);
                //     // }
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_open_bal', OpeningBalance.toFixed(2));
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_close_bal', ClosingBalance.toFixed(2));
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_from_date', FromDate);
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_to_date', ToDate);
                //     // custWhatsSOARec.setFieldValue('custrecord_whats_soa_pdf_url', fullUrl);
                //     // var custWhatsSoaRecID = nlapiSubmitRecord(custWhatsSOARec);
                //     // nlapiLogExecution('DEBUG', 'custWhatsSoaRecID', custWhatsSoaRecID);

                //     soaStatus = true;
                //     return soaStatus;
                // } else {
                //     soaStatus = false;
                //     return soaStatus;
                // }
            } // if(OpeningBalance != 0)
        } catch (error) {
            nlapiLogExecution("debug", "ERROR IN SOAprint", error);
        }
    }

    function GetCustomerOpeningBalance1(CustID, FromDate, locationid, subcustomer, Subsidiary) {
        var TotInvoiceAmt = 0; // Total amount for invoices
        var TotNonInvoiceAmt = 0; // Total amount for non-invoice transactions
        var TotDebitAmt = 0; // Total debit amount for journal transactions
        var TotCreditAmt = 0; // Total credit amount for journal transactions

        try {
            var filters = [
                // new nlobjSearchFilter('entity', null, 'anyof', CustID), // 'entity' for the customer field
                // new nlobjSearchFilter('mainline', null, 'is', 'T'),
                // new nlobjSearchFilter('trandate', null, 'before', FromDate),
                //  new nlobjSearchFilter('subsidiary', null, 'anyof', Subsidiary),
                ["trandate", "before", FromDate],
                "AND",
                ["name", "anyof", CustID],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["subsidiary", "anyof", Subsidiary],
            ];


            if (locationid) {
                filters.push("AND", ["location", "anyof", locationid]);
            }
            // Add subcustomer filter if provided
            if (subcustomer) {
                filters.push("AND", [["custcol_sm_sub_cust", "anyof", subcustomer], "OR", ["custbody_sub_customer", "anyof", subcustomer]]);
            }

            var columns = [
                new nlobjSearchColumn('type', null, 'group'),
                new nlobjSearchColumn('amount', null, 'sum'),
                new nlobjSearchColumn("accounttype", null, "GROUP"),
                new nlobjSearchColumn("creditamount", null, "SUM"),
                new nlobjSearchColumn("debitamount", null, "SUM")
            ];

            var transactionSearchResults = nlapiSearchRecord('transaction', null, filters, columns);
            // nlapiLogExecution("DEBUG", "transactionSearchResults", JSON.stringify(transactionSearchResults));

            if (transactionSearchResults) {
                for (var i = 0; i < transactionSearchResults.length; i++) {
                    var TType = transactionSearchResults[i].getValue('type', null, 'group');
                    var TAmount = parseFloat(transactionSearchResults[i].getValue('amount', null, 'sum'));
                    var acctype = transactionSearchResults[i].getValue("accounttype", null, "GROUP");
                    var creditamount = parseFloat(transactionSearchResults[i].getValue("creditamount", null, "SUM"));
                    var debitamount = parseFloat(transactionSearchResults[i].getValue("debitamount", null, "SUM"));

                    // nlapiLogExecution("DEBUG", "Transaction TType", TType);
                    // nlapiLogExecution("DEBUG", "Transaction TAmount", TAmount);
                    // nlapiLogExecution("DEBUG", "Transaction acctype", acctype);
                    // nlapiLogExecution("DEBUG", "Transaction creditamount", creditamount);
                    // nlapiLogExecution("DEBUG", "Transaction debitamount", debitamount);

                    if (TType === "CustInvc") {
                        // If type is Invoice, add to the invoice total
                        TotInvoiceAmt += TAmount;
                    } else if (TType === "Journal" && acctype == "AcctRec") {
                        // If type is Journal and account type is Accounts Receivable
                        if (debitamount > 0) {
                            TotDebitAmt += debitamount;  // Accumulate debit amount for accounts receivable
                        }
                        if (creditamount > 0) {
                            TotCreditAmt += creditamount;  // Accumulate credit amount for accounts receivable
                        }
                    } else {
                        // If type is not Invoice or Journal, treat as non-invoice and accumulate total
                        TotNonInvoiceAmt += Math.abs(TAmount);
                    }
                }

                // nlapiLogExecution("DEBUG", "Total Invoice Amount", TotInvoiceAmt);
                // nlapiLogExecution("DEBUG", "Total Non-Invoice Amount", TotNonInvoiceAmt);
                // nlapiLogExecution("DEBUG", "Total Debit Amount for AcctRec Journal", TotDebitAmt);
                // nlapiLogExecution("DEBUG", "Total Credit Amount for AcctRec Journal", TotCreditAmt);

                // Calculate the opening balance: Invoice amount minus Non-Invoice amount
                var openingBalance = TotInvoiceAmt - TotNonInvoiceAmt + TotDebitAmt - TotCreditAmt;
                // nlapiLogExecution("DEBUG", "Opening Balance", openingBalance);

                return openingBalance;
            } else {
                nlapiLogExecution("DEBUG", "No Transactions Found");
                return 0; // No transactions found, return 0
            }

        } catch (e) {
            nlapiLogExecution('ERROR', 'GetCustomerOpeningBalance1 Error', e.message);
            return 0; // Return 0 in case of error
        }
    }

    function GetTransactionDetails(CustID, FromDate, locationid, subcustomer, ToDate, Subsidiary) {
        var results = null;
        // nlapiLogExecution("debug", "sub customer", subcustomer);
        // nlapiLogExecution("debug", "locationid", locationid);

        try {
            var filters = [
                ["type", "anyof", "CustCred", "CustInvc", "CustPymt"],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["trandate", "within", FromDate, ToDate],
                "AND",
                ["entity", "is", CustID],
                //"AND",
                //["location", "anyof", locationid],
                "AND",
                ["subsidiary", "anyof", Subsidiary],
                "AND",
                ["status", "anyof", "CustCred:A", "CustInvc:A", "CustPymt:C", "CustInvc:B", "CustCred:B"]
                // "AND",
                //  ["amount", "greaterthan", "0"]
            ];
            if (locationid) {
                filters.push("AND", ["location", "anyof", locationid]);
            }
            // Add subcustomer filter if provided
            if (subcustomer) {
                filters.push("AND", ["custbody_sub_customer", "anyof", subcustomer]);
            }

            var columns = [
                new nlobjSearchColumn('internalid'),
                new nlobjSearchColumn('tranid'),
                new nlobjSearchColumn('custbody_sm_ori_docu_no'),
                new nlobjSearchColumn('trandate'),
                new nlobjSearchColumn('type'),
                new nlobjSearchColumn('memo'),
                new nlobjSearchColumn('amount'),
                new nlobjSearchColumn('status'),
                new nlobjSearchColumn('custbody_cardtype'),
            ];

            // Execute the search
            results = nlapiSearchRecord('transaction', null, filters, columns);

            // Log the search results

            return results;
        } catch (e) {
            // Log the error message
            nlapiLogExecution("ERROR", "GetTransactionDetails Error", e.message);
            return results;
        }
    }

    function GetTransactionDetailsJV(CustID, FromDate, locationid, subcustomer, ToDate, Subsidiary) {
        var results = null;
        // nlapiLogExecution("debug", "sub customer", subcustomer);
        // nlapiLogExecution("debug", "locationid", locationid);

        try {
            var filters = [
                ["type", "anyof", "Journal"],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["trandate", "within", FromDate, ToDate],
                "AND",
                ["entity", "is", CustID],
                // "AND",
                // ["location", "anyof", locationid],
                "AND",
                ["subsidiary", "anyof", Subsidiary],
                "AND",
                ["status", "anyof", "Journal:B"]
            ];
            if (locationid) {
                filters.push("AND", ["location", "anyof", locationid]);
            }
            // Add subcustomer filter if provided
            if (subcustomer) {
                //filters.push("AND", ["custbody_sm_jour_sub_customer", "anyof", subcustomer]);
                //filters.push("AND", ["custbody_sub_customer", "anyof", subcustomer]);
                filters.push("AND", ["custcol_sm_sub_cust", "anyof", subcustomer]);

            }

            var columns = [
                new nlobjSearchColumn('internalid'),
                new nlobjSearchColumn('tranid'),
                new nlobjSearchColumn('custbody_sm_ori_docu_no'),
                new nlobjSearchColumn('trandate'),
                new nlobjSearchColumn('type'),
                new nlobjSearchColumn('memo'),
                new nlobjSearchColumn('creditamount'),
                new nlobjSearchColumn('debitamount'),
                new nlobjSearchColumn('status'),
                new nlobjSearchColumn('accounttype'),
                new nlobjSearchColumn('custbody_cardtype'),
            ];

            // Execute the search
            results = nlapiSearchRecord('transaction', null, filters, columns);

            // Log the search results
            // nlapiLogExecution("DEBUG", "GetTransactionJVDetails Results", results);
            return results;
        } catch (e) {
            // Log the error message
            nlapiLogExecution("ERROR", "GetTransactionDetails Error", e.message);
            return results;
        }
    }

    function GetTransactionDetailsCF(CustID, FromDate, locationid, subcustomer, ToDate, Subsidiary) {
        var results = null;

        try {
            var filters = [
                ["type", "anyof", "CustRfnd"],
                "AND",
                ["mainline", "is", "T"],
                "AND",
                ["trandate", "within", FromDate, ToDate],
                "AND",
                ["entity", "is", CustID],
                // "AND",
                // ["location", "anyof", locationid],
                "AND",
                ["subsidiary", "anyof", Subsidiary]
            ];
            if (locationid) {
                filters.push("AND", ["location", "anyof", locationid]);
            }
            // Add subcustomer filter if provided
            if (subcustomer) {
                filters.push("AND", ["custbody_sub_customer", "anyof", subcustomer]);
            }

            var columns = [
                new nlobjSearchColumn('internalid'),
                new nlobjSearchColumn('transactionnumber'),
                new nlobjSearchColumn('custbody_sm_ori_docu_no'),
                new nlobjSearchColumn('trandate'),
                new nlobjSearchColumn('type'),
                new nlobjSearchColumn('memo'),
                new nlobjSearchColumn('total'),
                new nlobjSearchColumn('status'),
                new nlobjSearchColumn('custbody_cardtype'),
            ];

            // Execute the search
            results = nlapiSearchRecord('transaction', null, filters, columns);

            // Log the search results
            // nlapiLogExecution("DEBUG", "GetTransactionDetailsCF Results", JSON.stringify(results));
            return results;
        } catch (e) {
            // Log the error message
            nlapiLogExecution("ERROR", "GetTransactionDetails Error", e.message);
            return results;
        }
    }

    function escapeXml(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/'/g, "&apos;")
            .replace(/"/g, "&quot;");
    }

    function searchSubCustomerList(CustID, subCustName) {
        var resultsArray = [];

        try {
            // Perform the search
            var searchResults = nlapiSearchRecord("customrecord_sub_customer_list", null, [
                ["custrecord_parent_customer", "anyof", CustID],
                "AND",
                ["name", "is", subCustName]
            ], [
                new nlobjSearchColumn("name"),
                new nlobjSearchColumn("custrecord_parent_customer"),
                new nlobjSearchColumn("custrecord_customer_country"),
                new nlobjSearchColumn("custrecord_customer_addresse"),
                new nlobjSearchColumn("custrecord_customer_addrs_1"),
                new nlobjSearchColumn("custrecord_customer_address_2"),
                new nlobjSearchColumn("custrecord_customer_city"),
                new nlobjSearchColumn("custrecord_customer_state"),
                new nlobjSearchColumn("custrecord_customer_pin")
            ]);

            // Check if search results exist
            if (searchResults && searchResults.length > 0) {
                for (var i = 0; i < searchResults.length; i++) {
                    var result = searchResults[i];

                    // Push the desired fields into the results array
                    resultsArray.push({
                        name: result.getValue("name"),
                        parentCustomer: result.getValue("custrecord_parent_customer"),
                        country: result.getValue("custrecord_customer_country"),
                        address: result.getValue("custrecord_customer_addresse"),
                        address1: result.getValue("custrecord_customer_addrs_1"),
                        address2: result.getValue("custrecord_customer_address_2"),
                        city: result.getValue("custrecord_customer_city"),
                        state: result.getText("custrecord_customer_state"),
                        pin: result.getValue("custrecord_customer_pin")
                    });
                }
            }
        } catch (e) {
            nlapiLogExecution("ERROR", "Search Error", e.toString());
        }

        return resultsArray;
    }

    function sendWhatappMessageMAS(whatsURL, mobileNumber) {
        try {
            // nlapiLogExecution('debug', 'mobileNumber', mobileNumber);
            // Call the function to get authId
            var authId = getAuthIDMAS();

            // Call the function to send the message
            if (authId) {
                sendMessageMAS(authId, whatsURL, mobileNumber);
            } else {
                nlapiLogExecution('DEBUG', 'No authId received');
            }
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in sendWhatappMessage', e.message);
        }
    }

    function getAuthIDMAS() {
        try {
            var URL1 = "https://apis.rmlconnect.net/auth/v1/login/";
            var headers1 = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            };
            // nlapiLogExecution('DEBUG', 'Headers for Auth Request', JSON.stringify(headers1));

            var body1 = {
                "username": "maswhats",
                "password": "mas@rml123"
            };
            // nlapiLogExecution('DEBUG', 'Body for Auth Request', JSON.stringify(body1));

            var response1 = nlapiRequestURL(URL1, JSON.stringify(body1), headers1, 'POST');
            // nlapiLogExecution("DEBUG", "Response from Auth Request", response1.getBody());

            // Parse the response body to get JWTAUTH
            var responseBody1 = JSON.parse(response1.getBody());
            // nlapiLogExecution("DEBUG", "Parsed Auth Response Body", JSON.stringify(responseBody1));
            var authId = responseBody1.JWTAUTH; // Extracting JWTAUTH from the response
            // nlapiLogExecution('DEBUG', 'Auth ID', authId);
            return authId;
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in getAuthID', e.message);
            return null; // Return null if there is an error
        }
    }

    function sendMessageMAS(authID, whatsURL, mobileNumber) {
        try {
            // var FromDate = getDateRange().fromDate;
            var ToDate = getDateRange().toDate;
            var whatsDate = ToDate.split("/")[1] + "/" + ToDate.split("/")[0] + "/" + ToDate.split("/")[2];
            // nlapiLogExecution('DEBUG', 'whatsDate', whatsDate);
            var formattedDate = new Date(whatsDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long'
            });

            var URL2 = "https://apis.rmlconnect.net/wba/v1/messages";
            var headers2 = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": authID // Use the received authId
            };
            // nlapiLogExecution('DEBUG', 'Headers for Message Request', JSON.stringify(headers2));

            var body2 = {
                "extra": "string",
                "media": {
                    "body": [
                        {
                            "text": " statement of accounts as of " + formattedDate
                        }
                    ],
                    "header": [
                        {
                            "document": {
                                "link": whatsURL
                            }
                        }
                    ],
                    "lang_code": "en",
                    "template_name": "mas_soa",
                    "type": "media_template"
                },
                // "phone": mobileNumber // Use the dynamic mobile number
                "phone": '+919123535214' // MAS Testing
            };
            // nlapiLogExecution('DEBUG', 'Body for Message Request', JSON.stringify(body2));

            var response2 = nlapiRequestURL(URL2, JSON.stringify(body2), headers2, 'POST');
            nlapiLogExecution("DEBUG", "Response from Message Request", response2.getBody());
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in sendMessage', e.message);
        }
    }

    function sendWhatappMessageSM(whatsURL, mobileNumber) {
        try {
            // nlapiLogExecution('debug', 'mobileNumber', mobileNumber);
            // Call the function to get authId
            var authId = getAuthIDSM();

            // Call the function to send the message
            if (authId) {
                sendMessageSM(authId, whatsURL, mobileNumber);
            } else {
                nlapiLogExecution('DEBUG', 'No authId received');
            }
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in sendWhatappMessage', e.message);
        }
    }

    function getAuthIDSM() {
        try {
            var URL1 = "https://apis.rmlconnect.net/auth/v1/login/";
            var headers1 = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            };
            // nlapiLogExecution('DEBUG', 'Headers for Auth Request', JSON.stringify(headers1));

            var body1 = {
                "username": "tvsmotwhats",
                "password": "tvs@123rml"
            };
            // nlapiLogExecution('DEBUG', 'Body for Auth Request', JSON.stringify(body1));

            var response1 = nlapiRequestURL(URL1, JSON.stringify(body1), headers1, 'POST');
            // nlapiLogExecution("DEBUG", "Response from Auth Request", response1.getBody());

            // Parse the response body to get JWTAUTH
            var responseBody1 = JSON.parse(response1.getBody());
            // nlapiLogExecution("DEBUG", "Parsed Auth Response Body", JSON.stringify(responseBody1));
            var authId = responseBody1.JWTAUTH; // Extracting JWTAUTH from the response
            // nlapiLogExecution('DEBUG', 'Auth ID', authId);
            return authId;
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in getAuthID', e.message);
            return null; // Return null if there is an error
        }
    }

    function sendMessageSM(authID, whatsURL, mobileNumber) {
        try {
            // var FromDate = getDateRange().fromDate;
            var ToDate = getDateRange().toDate;
            var whatsDate = ToDate.split("/")[1] + "/" + ToDate.split("/")[0] + "/" + ToDate.split("/")[2];
            // nlapiLogExecution('DEBUG', 'whatsDate', whatsDate);
            var formattedDate = new Date(whatsDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long'
            });

            var URL2 = "https://apis.rmlconnect.net/wba/v1/messages";
            var headers2 = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": authID // Use the received authId
            };
            // nlapiLogExecution('DEBUG', 'Headers for Message Request', JSON.stringify(headers2));

            var body2 = {
                "extra": "string",
                "media": {
                    "body": [
                        {
                            "text": " statement of accounts as of " + formattedDate
                        }
                    ],
                    "header": [
                        {
                            "document": {
                                "link": whatsURL
                            }
                        }
                    ],
                    "lang_code": "en",
                    "template_name": "masnew_soa_doc",
                    "type": "media_template"
                },
                // "phone": mobileNumber // Use the dynamic mobile number
                "phone": '+919123535214' // SM Testing
            };
            // nlapiLogExecution('DEBUG', 'Body for Message Request', JSON.stringify(body2));

            var response2 = nlapiRequestURL(URL2, JSON.stringify(body2), headers2, 'POST');
            // nlapiLogExecution("DEBUG", "Response from Message Request", response2.getBody());
        } catch (e) {
            nlapiLogExecution('ERROR', 'Error in sendMessage', e.message);
        }
    }

    function getOrCreateFolder(folderName, parentFolderId, sendWhatsApp, whatsUICreatedUser) {
        if (sendWhatsApp == 'T') {
            var existingFolderId = getFolderId(folderName, parentFolderId);
            if (existingFolderId) {
                nlapiLogExecution('DEBUG', 'Folder Exists', 'Folder "' + folderName + '" already exists with ID: ' + existingFolderId);
                return existingFolderId;
            }

            // Create the new folder
            var folderRecord = nlapiCreateRecord('folder');
            folderRecord.setFieldValue('name', folderName);
            folderRecord.setFieldValue('parent', parentFolderId); // Set parent folder

            var folderId = nlapiSubmitRecord(folderRecord);
            nlapiLogExecution('DEBUG', 'Folder Created', 'Folder "' + folderName + '" created with ID: ' + folderId);
            return folderId;
        } else {
            var existingFolderId = getFolderId(folderName, parentFolderId);
            if (existingFolderId) {
                nlapiLogExecution('DEBUG', 'Folder Exists', 'Folder "' + folderName + '" already exists with ID: ' + existingFolderId);
                // return existingFolderId;
                var creatorFolderId = getFolderId(whatsUICreatedUser, existingFolderId);
                if (creatorFolderId) {
                    nlapiLogExecution('DEBUG', 'User Folder Exists', 'Folder "' + whatsUICreatedUser + '" already exists with ID: ' + creatorFolderId);
                    // deleteFolders(existingFolderId, creatorFolderId); // (parentFolderId, excludeFolderId)
                    return creatorFolderId;
                } else {
                    var folderRecord1 = nlapiCreateRecord('folder');
                    folderRecord1.setFieldValue('name', whatsUICreatedUser);
                    folderRecord1.setFieldValue('parent', existingFolderId); // Set parent folder
                    var folderId1 = nlapiSubmitRecord(folderRecord1);
                    nlapiLogExecution('DEBUG', 'Folder Created', 'Folder "' + whatsUICreatedUser + '" created with ID: ' + folderMonthId1);
                    return folderId1;
                }
            } else {
                // Create the new folder
                var folderRecord = nlapiCreateRecord('folder');
                folderRecord.setFieldValue('name', folderName);
                folderRecord.setFieldValue('parent', parentFolderId); // Set parent folder
                var folderMonthId = nlapiSubmitRecord(folderRecord);

                var folderRecord1 = nlapiCreateRecord('folder');
                folderRecord1.setFieldValue('name', whatsUICreatedUser);
                folderRecord1.setFieldValue('parent', folderMonthId); // Set parent folder
                var folderId1 = nlapiSubmitRecord(folderRecord1);
                nlapiLogExecution('DEBUG', 'Folder Created', 'Folder "' + whatsUICreatedUser + '" created with ID: ' + folderId1);
                // deleteFolders(folderMonthId, folderId1); // (parentFolderId, excludeFolderId)
                return folderId1;
            }
        }
    }

    /**
     * Function to check if a folder already exists inside a parent folder
     */
    function getFolderId(folderName, parentFolderId) {
        var filters = [
            new nlobjSearchFilter('name', null, 'is', folderName),
            new nlobjSearchFilter('parent', null, 'anyof', parentFolderId) // Ensure it's inside the correct parent
        ];
        var columns = [new nlobjSearchColumn('internalid')];
        var results = nlapiSearchRecord('folder', null, filters, columns);
        return results ? results[0].getValue('internalid') : null;
    }

    function deleteFolders(parentFolderId, excludeFolderId) {
        var folderSearch = nlapiSearchRecord("folder", null, [
            ["parent", "anyof", parentFolderId],
            "AND",
            ["internalidnumber", "notequalto", excludeFolderId]
        ], [
            new nlobjSearchColumn("internalid"),
            new nlobjSearchColumn("name")
        ]);

        if (folderSearch && folderSearch.length > 0) {
            for (var i = 0; i < folderSearch.length; i++) {
                var folderId = folderSearch[i].getId();
                var folderName = folderSearch[i].getValue("name");

                // Step 1: Delete files in this folder
                deleteFilesInFolder(folderId);

                // Step 2: Delete the folder
                try {
                    nlapiDeleteRecord("folder", folderId);
                    nlapiLogExecution("AUDIT", "Folder Deleted", "Deleted Folder: " + folderName + " (ID: " + folderId + ")");
                } catch (e) {
                    nlapiLogExecution("ERROR", "Failed to Delete Folder", "Folder: " + folderName + " (ID: " + folderId + ") - Error: " + e.message);
                }
            }
        } else {
            nlapiLogExecution("AUDIT", "No Folders Found", "No folders found under parent folder ID: " + parentFolderId);
        }
    }

    function deleteFilesInFolder(folderId) {
        var fileSearch = nlapiSearchRecord("file", null, [
            ["folder", "anyof", folderId]
        ], [
            new nlobjSearchColumn("internalid"),
            new nlobjSearchColumn("name")
        ]);

        if (fileSearch && fileSearch.length > 0) {
            for (var j = 0; j < fileSearch.length; j++) {
                var fileId = fileSearch[j].getId();
                var fileName = fileSearch[j].getValue("name");

                try {
                    nlapiDeleteRecord("file", fileId);
                    nlapiLogExecution("AUDIT", "File Deleted", "Deleted File: " + fileName + " (ID: " + fileId + ")");
                } catch (e) {
                    nlapiLogExecution("ERROR", "Failed to Delete File", "File: " + fileName + " (ID: " + fileId + ") - Error: " + e.message);
                }
            }
        }
    }

    function formatDateDDMMYYYY(dateObj) {
        if (!dateObj) return '';

        var day = dateObj.getDate();
        var month = dateObj.getMonth() + 1; // Months are 0-based
        var year = dateObj.getFullYear();

        // Add leading zero if needed
        day = (day < 10) ? '0' + day : day;
        month = (month < 10) ? '0' + month : month;

        return day + '/' + month + '/' + year;
    }



    function getLocationNameandCode(params) {
        try {
            // Search for locations based on the provided internal ID
            // nlapiLogExecution("debug", "getLocationNameandCode params", params);
            var locationSearch = nlapiSearchRecord("location", null,
                [
                    ["internalid", "anyof", params]
                ],
                [
                    // Column 1: Location Name (no hierarchy)
                    new nlobjSearchColumn("namenohierarchy"),

                    // Column 2: First part of location name (before space)
                    new nlobjSearchColumn("formulatext").setFormula(
                        "CASE WHEN INSTR({namenohierarchy}, ' ') > 0 THEN SUBSTR({namenohierarchy}, 1, INSTR({namenohierarchy}, ' ') - 1) ELSE {namenohierarchy} END"
                    ),

                    // Column 3: Second part of location name (after space)
                    new nlobjSearchColumn("formulatext").setFormula(
                        "CASE WHEN INSTR({namenohierarchy}, ' ') > 0 THEN SUBSTR({namenohierarchy}, INSTR({namenohierarchy}, ' ') + 1) ELSE NULL END"
                    )
                ]
            );
            // nlapiLogExecution("debug", "locationSearch", locationSearch);

            var locResArr = [];
            if (locationSearch && locationSearch.length > 0) {
                for (var i = 0; i < locationSearch.length; i++) {
                    var locResult = locationSearch[i];
                    var columns = locResult.getAllColumns();

                    // Access columns by index
                    var locationCode = locResult.getValue(columns[1]); // First part of name
                    var locationName = locResult.getValue(columns[2]); // Second part of name

                    // Add the extracted information to the result array
                    locResArr.push(locationCode);
                    locResArr.push(locationName);
                }
            }

            // Return the result array
            // nlapiLogExecution("debug", "locResArr", locResArr);
            return locResArr;

        } catch (error) {
            nlapiLogExecution("debug", "error in getLocationNameandCode", error.message);
        }
    }
}  