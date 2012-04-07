var studentList, importDialog, settings = {};
var scantronBackgroundImage = new Image();
scantronBackgroundImage.src = 'images/scantron-small.jpg';

$(document).ready(function() {
    // Set up all the syncronized widgets so that the sae settings can be changed from multiple places
    settings['testDate'] = new SyncronizedWidget($('.sync-testDate'));
    settings['testDate'].addContent("<input id='datepicker-importSettings' class='datepicker' type='text' />");
    settings['courseNumber'] = new SyncronizedWidget($('.sync-courseNumber'));
    settings['courseNumber'].addContent("<input id='classNumber-importSettings' type='text' />");
    settings['encodeSection'] = new SyncronizedWidget($('.sync-encodeSection'));
    settings['encodeSection'].addContent("<input id='encodeSection-importSettings' type='checkbox' value='encodeSection' checked='true' />");


    // Set up the drag and drop
    var dropbox = document.getElementById("dropbox");
    dropbox.addEventListener("dragenter", dragEnter, false);
    dropbox.addEventListener("dragexit", dragExit, false);
    dropbox.addEventListener("dragover", dragOver, false);
    dropbox.addEventListener("drop", drop, false);


    $('#tabs').tabs();
    $('.button').button();
    $('.datepicker').datepicker();
    $('#files').change(openFile);
    $('#makePdfButton').click(makePdf);
    $('#exportProgress').progressbar();
    $('#exportProgress').hide();

    importDialog = new ImportDialog;
    $('#errorDialog').dialog({
        autoOpen: false,
        modal: true,
        buttons: {
            Ok: function() { $(this).dialog('close'); }
        }
    });

});

function makePdf() {
    $('#exportProgress').show(200);
    var doc = new jsPDF('landscape', 'pt', 'letter');
    // TODO: make this read from settings
    var scantronLayout = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT];
    // get the printer offset from the option box
    var printerOption = $('#outputPrinter option:selected').val();
    var printerOffsets;
    try {
        printerOffsets = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT]['_printerOffsets'][printerOption];
    } catch(e) {}
    if (!printerOffsets) {
        printerOffsets = [0, 0];
    }

    var columns = studentList.columns;
    
    // Loop through each row of the table and make a new page for each
    var formattedStudentData = [];
    $('#studentList tbody tr').each(function(rowIndex, tr) {
        var row = $('td', tr);
        var rowData = row.map(function(i, x) { return $(x).text(); });
        
        var data = {};
        $(columns).each(function(i, item) {
            data[item] = rowData[i];
        });

        data = processUVicRow(data, settings['encodeSection'].value);
        formattedStudentData.push(data);
    });
    // Now that we have the data, let's sort it in the right way
    switch ($('#sorting option:selected').val()) {
        case 'name':
            formattedStudentData = formattedStudentData.sort(function(a,b){
                return a['Name'] > b['Name'];
            });
            break;
        case 'section-name':
            formattedStudentData = formattedStudentData.sort(function(a,b){
                return a['Course and Section'] > b['Course and Section'] ||
                    (a['Course and Section'] === b['Course and Section'] && a['Name'] > b['Name']);
            });
            break;
        case 'id':
            formattedStudentData = formattedStudentData.sort(function(a,b){
                return a['Student ID'] > b['Student ID'];
            });
            break;
    }


    var numItems = formattedStudentData.length;

    var st = new Scantron(scantronLayout, printerOffsets);
    doc.setFont('courier');
    // Since we don't want to block the UI for too long, we need to create
    // the pdf in chunks
    function addPdfChunk(start, numChunksToAdd) {
        var i;
        // When doc is created, it already has a blank page, so we don't need to create one
        // for index 0
        if (start === 0) {
            st.fillPdf(formattedStudentData[0], doc);
            start++;
        }
        for (i = start; i < formattedStudentData.length && i < start + numChunksToAdd; i++) {
            doc.addPage();
            st.fillPdf(formattedStudentData[i], doc);
        }
        $('#exportProgress').progressbar({ value: i/formattedStudentData.length*100 });
        if (i === formattedStudentData.length) {
            onPdfCompletion();
            return;
        }
        
        setTimeout(addPdfChunk, 0, start + numChunksToAdd, numChunksToAdd);
    }
    function onPdfCompletion() {
        doc.setProperties({
            title: 'Prefilled Scantron',
            creator: 'Scantronulate',
            subject: 'Printer correction offset: [' + printerOffsets + '] (in pts)'
        });

        // Serve up the pdf to the user
        doc.output('datauri');
        $('#exportProgress').hide(200);
    }

    // Start creating the actual PDF
    addPdfChunk(0, 50)

}

// Processes the strings in data and returns a properly formatted object
// We assume data has keys:
//      'Course and Section': the section
//      'Student ID': the student's ID
//      'Name': Comma separated "last, first" name
function processUVicRow(data, encodeSectionNumber) {
    // convert a section number into letters so that it may be encoded into the username
    function encodeSection(sectionNumber) {
        var encodeTable = { '0':'a', '1':'b', '2':'c', '3':'d', '4':'e', '5':'f', '6':'g', '7':'h', '8':'i', '9':'j' };
        return (sectionNumber.split('').map(function(x){ return encodeTable[x]; })).join('');
    }

    // Set 'Course and Section'
    var courseNumber = '100';
    if (settings['courseNumber'].value && settings['courseNumber'].value.length > 0) {
        courseNumber = $.trim(settings['courseNumber'].value);
    } else if (data['Course Number']) {
        match = data['Course Number'].match(/(\d+)/);
        if (match) {
            courseNumber = match[0];
        }
    }
    var sectionNumber = '01', match;
    if (data['Course and Section'] || data['Section']) {
        sectionNumber = data['Course and Section'] || data['Section'];
        match = sectionNumber.match(/(\d+)/);
        if (match) {
            sectionNumber = match[1];
        }
    }

    // Set 'Name'
    var name = 'NoLast, NoFirst', nameLast = 'NoLast', nameFirst='NoFirst';
    if (data['Last, First Name']) {
        name = data['Name'];
    }
    match = name.match(/(.*),(.*)/);
    if (match) {
        nameLast = match[1].replace(/\W/g, '');
        nameFirst = match[2].replace(/\W/g, '');
    }
    if (data['Last Name']) {
        nameLast = data['Last Name'].replace(/\W/g, '');
    }
    if (data['First Name']) {
        nameFirst = data['First Name'].replace(/\W/g, '');
    }

    var studentId = '000000';
    match = null;
    if (data['Student ID']) {
        match = data['Student ID'].match(/(\d+)/);
    }
    if (match) {
        studentId = match[1].substr(-6);
    }

    var testDay='00', testMonth='00', testYear='0000';
    var date = settings['testDate'].value;
    match = date.match(/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
        testMonth = match[1];
        testDay = match[2];
        testYear = match[3];
    }
    // Format the dates so they are 2 digits long with leading zeros
    testDay = ('0000' + testDay).substr(-2);
    testYear = ('0000' + testYear).substr(-2);
    // The month should be a digit 1-12
    testMonth = '' + parseInt(testMonth, 10);
    
    
    // Format how we want it output to the scantron
    var outputData = {};
    outputData['Student ID'] = studentId;
    outputData['Course and Section'] = courseNumber + sectionNumber;
    outputData['Month'] = testMonth;
    outputData['Day'] = testDay;
    outputData['Year'] = testYear;
    if (encodeSectionNumber) {
        outputData['Name'] = encodeSection(sectionNumber) + ' ' + nameLast + ' ' + nameFirst;
    } else {
        outputData['Name'] = nameLast + ' ' + nameFirst;
    }
    
    return outputData;
}

// Creates a dataTables table to display the student list
function StudentList() {
    this._init.apply(this, arguments);
}
StudentList.prototype = {
    _init: function(columns, data, scantronLayout) {
        this.columns = $.extend(true, [], columns);
        this.data = $.extend(true, [], data);
        this.scantronLayout = scantronLayout || SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT];

        // remove any events that already are assigned to the rows
        $('#studentListTable tbody tr').die();

        $('#studentList').empty();
        var table = '<table id="studentListTable" cellpadding="0" cellspacing="0" border="0" width="200px"><thead><tr>', i;
        $(columns).each(function(i, item) {
            table += '<th>' + item + '</th>';
        });
        table += '</tr></thead></table>';
        $('#studentList').append(table)
        // Don't manipulate the table till it's in the DOM, otherwise
        // it will resize crazy (among other bad things).
        this.studentList = $('#studentListTable').dataTable({
            bPaginate: false,
            bJQueryUI: true,
            sScrollY: '200px',
            sScrollX: '100%',
            bProcessing: true,
        });
        if (data) {
            this.update(data);
        }
        
        // Add a row callback
        $('#studentListTable tbody tr').live('click', this.studentListClick.bind(this));
    },

    update: function(data) {
        this.studentList.fnClearTable();
        this.studentList.fnAddData(data);
        this.studentList.fnDraw();
    },

    // Callback for when a row is clicked.
    studentListClick: function(evt) {
        var target = evt.currentTarget;
        // Handle the highlighting of a selected row
        if ($(target).hasClass('row_selected')) {
            $(target).removeClass('row_selected');
        } else {
            $('#studentListTable .row_selected').removeClass('row_selected');
            $(target).addClass('row_selected');
        }

        // Extract the data and pass it to the preview function
        var clickedRow = $('td', target);
        var rowData = clickedRow.map(function(i, x) { return $(x).text(); });
        var data = {};
        $(this.columns).each(function(i, item) {
            data[item] = rowData[i];
        });
        
        this.previewData(data);
    },

    previewData: function (data) {
        var canvas = document.getElementById('canvas');
        if (canvas.getContext) {
            // Set up the dimensions of the canvas to match those of the image.
            // This is different than the css settings which only affect the display
            // width/height and not the resolution given to the canvas
            canvas.setAttribute('width', scantronBackgroundImage.width);
            canvas.setAttribute('height', scantronBackgroundImage.height);

            var ctx = canvas.getContext('2d');
            ctx.drawImage(scantronBackgroundImage, 0, 0, canvas.width, canvas.height);
            ctx.font = '15pt Courier';

            // Scale the context so we are dealing with values in pt=1/72in as
            // if we were working with an 11x8.5in paper (i.e., 792x612 pts)
            var widthInPts = 792, heightInPts = 612;
            ctx.save();
            ctx.scale(canvas.width/widthInPts, canvas.height/heightInPts);

            // Render the row to the preview area
            var canvasPdf = new CanvasPdf(ctx);
            var st = new Scantron(this.scantronLayout);
            st.fillPdf(processUVicRow(data, $('#encodeSection-importSettings').prop('checked')), canvasPdf);

            ctx.restore();
        }
    }
}


// Creates an import dialog.  This dialog can then be initialized with data
function ImportDialog() {
    this._init.apply(this, arguments);
}
ImportDialog.prototype = {
    _init: function() {
        this.data = [];
        $('#datepicker-importSettings').datepicker();
        // Set the date to today's date and make sure we trigger a change event
        // so that the settings propogate appropriately
        var today = new Date();
        var prettyDate = (today.getMonth()+1) + '/' + today.getDate() + '/' + today.getFullYear();
        $('#datepicker-importSettings').val(prettyDate);
        $('#datepicker-importSettings').trigger('change');
        
        $('#fromRow-importSettings').change(this.rowFromChange.bind(this));
        this.dialog = $('#importDialog').dialog({
            autoOpen: false,
            modal: true,
            width: '80%',
            buttons: {
                Cancel: this.close.bind(this),
                Import: this.importClick.bind(this)
            }
        });
    },

    open: function() {
        $('#droplabel').html('Drop CSV File');
        this.dialog.dialog('open');
    },
    
    close: function() {
        this.dialog.dialog('close');
    },

    getHeadersFromConfig: function() {
        // TODO: have this be configurable and not just read from the default!
        var scantronConfig = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT];
        if (scantronConfig._defaultOrder) {
            return scantronConfig._defaultOrder;
        }
        return Object.keys(scantronConfig).filter(function(x){ return x.charAt(0) !== '_'; });
    },

    importClick: function() {
        // TODO: have this be configurable and not just read from the default!
        var scantronConfig = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT];
        
        var rowFrom = parseInt($('#fromRow-importSettings').attr('value'), 10);
        var rowLabels = $('#table-importSettings thead option:selected').map(function(i, item){ return $(item).val(); });
        // get a filtered list of the row indices that are acually used
        // and while we're at it, filter the nouse out of rowLabels
        var usedRowIndices = [];
        $(rowLabels).each(function(i, item) {
            if (item !== 'nouse') {
                usedRowIndices.push(i);
            }
        });
        rowLabels = $(usedRowIndices).map(function(i, item) { return rowLabels[item]; });

        // Create a new array that is appropriately sized 
        var imported = [], row, i, j;
        for (i = rowFrom; i < this.data.length; i++) {
            row = [];
            if (this.data[i].length >= rowLabels.length) {
                for (j = 0; j < usedRowIndices.length; j++) {
                    // Add the entry data unless it is undefined, in which case add the empty string
                    row.push(this.data[i][usedRowIndices[j]] == null ? "" : this.data[i][usedRowIndices[j]]);
                }
                imported.push(row);
            }
        }

        // Adjust the preview table accordingly
        studentList = new StudentList(rowLabels, imported);
        //studentList.fnAddData({"aoColumns": ['xxx','yyy','zzz','www']});

        // Wrap things up
        this.close();
        $('#tabs').tabs('select', '#tab-preview');
        // Call this so the header columns show up correctly sized
        // And while we're at it, simulate a click on the first row
        studentList.studentList.fnDraw();
        studentList.studentListClick({currentTarget: studentList.studentList.find('tbody tr')[0]});

        // Set up the printer types based on the scantronConfig's listed printers
        $('#outputPrinter').html('');
        $(Object.keys(scantronConfig['_printerOffsets'])).each(function(i, item) {
            $('#outputPrinter').append('<option value="'+item+'">'+item+'</option>');
        });
        $('#outputPrinter').append('<option value="none">Unspecified Printer</option>');
    },

    rowFromChange: function() {
        var rowFrom = parseInt($('#fromRow-importSettings').attr('value'), 10);
        $('#table-importSettings tbody').children().each(function(i, item) {
            if (i < rowFrom) {
                $(item).addClass('inactiveRow');
            } else {
                $(item).removeClass('inactiveRow');
            }
        });
    },

    // Set up an import dialog for selecting which columns, etc. are
    // relevant
    update: function(data) {
        // deepcopy data into our internal store
        this.data = $.extend(true, [], data);

        // We assume the number of columns is the max number of entries
        // in the first 4 rows
        var numCols = 1, i, j;
        for (i = 0; i < Math.min(this.data.length, 4); i++) {
            numCols = Math.max(numCols, this.data[i].length);
        }
        // Make the header

        // Construct the select box for choosing the type of each column
        var select = $('<select />');
        var headers = this.getHeadersFromConfig();
        var uniqueHeaders = {};
        $(headers).each(function(i, item) { uniqueHeaders[item] = true; });
        uniqueHeaders = Object.keys(uniqueHeaders);
        $(uniqueHeaders).each(function(i, item) {
                var option = '<option value="'+item+'">'+item+'</option>';
                if (item === 'nouse') {
                    option = '<option value="nouse">Don\'t Use</option>';
                }
                select.append(option);
        }.bind(this));
        // If we didn't already add a nouse option, add one at the end
        if (!select.find('option:[value="nouse"]').length) {
                select.append('<option value="nouse">Don\'t Use</option>');

        }

        var tableHead = $('#table-importSettings thead tr').empty();
        for (i=0; i < numCols; i++) {
            var selectUse = select.clone();
            selectUse.addClass('col-'+i);
            // Select the appropriate header from the default-header list
            if (headers[i]) {
                selectUse.find('option:[value="'+headers[i]+'"]').attr('selected', true);
            } else {
                selectUse.find('option:[value="nouse"]').attr('selected', true);
            }

            tableHead.append($('<th />').append(selectUse));
        }

        // Create the table entries
        var entries = "", row = "";
        for (j=0; j < Math.min(this.data.length, 4); j++) {
            var row = "";
            for (i=0; i < numCols; i++) {
                row += "<td>" + this.data[j][i] + "</td>";
            }
            entries += "<tr>" + row + "</tr>";
        }
        row = "";
        for (i=0; i < numCols; i++) {
            row += "<td>...</td>";
        }
        entries += row;
        $("#table-importSettings tbody").empty().append($(entries));

        this.rowFromChange();
    }
}

// Decode dataURI
function decodeDataURI(dataURI) {
    var content = dataURI.indexOf(","), meta = dataURI.substr(5, content).toLowerCase(), data = decodeURIComponent(dataURI.substr(content + 1));
	
    if (/;\s*base64\s*[;,]/.test(meta)) {
        data = atob(data); // decode base64
	}
    if (/;\s*charset=[uU][tT][fF]-?8\s*[;,]/.test(meta)) {
        data = decodeURIComponent(escape(data)); // decode UTF-8
    }
	
    return data;
};



// Drag and drop functions
function dragEnter(evt) {
    evt.stopPropagation();
    evt.preventDefault();
}
function dragExit(evt) {
    evt.stopPropagation();
    evt.preventDefault();
}
function dragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
}
function drop(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    var count = files.length;

    // Only call the handler if 1 or more files was dropped.
    if (count > 0)
        handleFiles(files);
}
function openFile(evt) {
    var files = evt.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFiles(files) {
    var file = files[0];

    document.getElementById("droplabel").innerHTML = "Processing " + file.name;

    var reader = new FileReader();

    // init the reader event handlers
    reader.onprogress = handleReaderProgress;
    reader.onloadend = handleReaderLoadEnd;

    // begin the read operation
    reader.readAsDataURL(file);
}
function handleReaderProgress(evt) {
    if (evt.lengthComputable) {
            var loaded = (evt.loaded / evt.total);
//		$("#progressbar").progressbar({ value: loaded * 100 });
    }
}

function handleReaderLoadEnd(evt) {
    //$("#progressbar").progressbar({ value: 100 });
    if (evt.target.error) {
        $('#errorCode').html(evt.target.error + ' Error Code: ' + evt.target.error.code + ' ');
        $('#errorDialog').dialog('open');
        return;
    }
    var data = decodeDataURI(evt.target.result);
    var parsed = CSVToArray(data);
    
    importDialog.update(parsed);
    importDialog.open();
}
