var studentList, importDialog;
var scantronBackgroundImage = new Image();
scantronBackgroundImage.src = 'images/scantron-small.jpg';

$(document).ready(function() {
    // Set up the drag and drop
    var dropbox = document.getElementById("dropbox");
    dropbox.addEventListener("dragenter", dragEnter, false);
    dropbox.addEventListener("dragexit", dragExit, false);
    dropbox.addEventListener("dragover", dragOver, false);
    dropbox.addEventListener("drop", drop, false);


    $('.button').button();
    $('#tabs').tabs();
    $('#files').change(openFile);
    $('#makePdfButton').click(makePdf);
/*    studentList = $('#studentListTable').dataTable({
        bPaginate: false,
        sScrollY: '100%',
        bProcessing: true,
    }); */

    importDialog = new ImportDialog;
    $('#errorDialog').dialog({
        autoOpen: false,
        modal: true,
        buttons: {
            Ok: function() { $(this).dialog('close'); }
        }
    });

/*    studentList.fnAddData(
         [
            [ 'V00678395', 'Humphrey, Charles', 'MTH100', 'A01' ],
            [ 'V00673325', 'Ray, Phil', 'MTH100', 'A01' ],
            [ 'V00878395', 'Bogart, Smith-Jones', 'MTH100', 'A01' ],
            [ 'V00378395', 'Woolz, Jen', 'MTH100', 'A01' ],
            [ 'V00875345', 'Humphrey, Von Roy', 'MTH100', 'A02' ],
        ]);
*/
});

function makePdf() {
    var doc = new jsPDF('landscape', 'pt', 'letter');
    // TODO: make this read from settings
    var scantronLayout = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT];
    var printerOffsets = SCANTRON_LAYOUTS[DEFAULT_SCANTRON_LAYOUT]['_printerOffsets']['4250'];
    var columns = studentList.columns;
    
    // Loop through each row of the table and make a new page for each
    $('#studentList tbody tr').each(function(rowIndex, tr) {
        var row = $('td', tr);
        var rowData = row.map(function(i, x) { return $(x).text(); });
        
        var data = {};
        $(columns).each(function(i, item) {
            data[item] = rowData[i];
        });

        data = processUVicRow(data);
        var st = new Scantron(scantronLayout, printerOffsets);
        st.fillPdf(data, doc, true);
        doc.addPage();
//        console.log(rowData, data, st);
    });

    // Serve up the pdf to the user
    doc.output('datauri');

}

// Processes the strings in data and returns a properly formatted object
// We assume data has keys:
//      'Course and Section': the section
//      'Student ID': the student's ID
//      'Name': Comma separated "last, first" name
function processUVicRow(data) {
    // convert a section number into letters so that it may be encoded into the username
    function encodeSection(sectionNumber) {
        var encodeTable = { '0':'a', '1':'b', '2':'c', '3':'d', '4':'e', '5':'f', '6':'g', '7':'h', '8':'i', '9':'j' };
        return (sectionNumber.split('').map(function(x){ return encodeTable[x]; })).join('');
    }

    var classNumber = '100';
    if ($('#classNumber-importSettings').val().length > 0) {
        classNumber = $.trim($('#classNumber-importSettings').val());
    }
    var sectionNumber = '01', match;
    if (data['Course and Section']) {
        sectionNumber = data['Course and Section'];
        match = sectionNumber.match(/(\d+)/);
        if (match) {
            sectionNumber = match[1];
        }
    }

    var name = 'NoLast, NoFirst', nameLast = 'NoLast', nameFirst='NoFirst';
    if (data['Name']) {
        name = data['Name'];
    }
    match = name.match(/(.*),(.*)/);
    if (match) {
        nameLast = match[1].replace(/\s/g, '');
        nameFirst = match[2].replace(/\s/g, '');
    }

    var studentId = '111111';
    match = null;
    if (data['Student ID']) {
        match = data['Student ID'].match(/(\d+)/);
    }
    if (match) {
        studentId = match[1].substr(-6);
    }

    var testDay='00', testMonth='00', testYear='0000';
    var date = $('#datepicker-importSettings').val();
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
    outputData['Course and Section'] = classNumber + sectionNumber;
    outputData['Month'] = testMonth;
    outputData['Day'] = testDay;
    outputData['Year'] = testYear;
    outputData['Name'] = encodeSection(sectionNumber) + ' ' + nameLast + ' ' + nameFirst
    
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

            // Scale the context so we are dealing with values in pt=1/72in as
            // if we were working with an 11x8.5in paper (i.e., 792x612 pts)
            var widthInPts = 792, heightInPts = 612;
            ctx.save();
            ctx.scale(canvas.width/widthInPts, canvas.height/heightInPts);

            // Render the row to the preview area
            var canvasPdf = new CanvasPdf(ctx);
            var st = new Scantron(this.scantronLayout);
            st.fillPdf(processUVicRow(data), canvasPdf);

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
        var today = new Date();
        var prettyDate = (today.getMonth()+1) + '/' + today.getDate() + '/' + today.getFullYear();
        $('#datepicker-importSettings').val(prettyDate);
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
        var rowFrom = parseInt($('#fromRow-importSettings').attr('value'), 10);
        var rowLabels = $('#table-importSettings thead option:selected').map(function(i, item){ return $(item).val(); });

        // Create a new array that is appropriately sized 
        var imported = [], row, i, j;
        for (i = rowFrom; i < this.data.length; i++) {
            row = [];
            if (this.data[i].length >= rowLabels.length) {
                for (j = 0; j < rowLabels.length; j++) {
                    // Add the entry data unless it is undefined, in which case add the empty string
                    row.push(this.data[i][j] == null ? "" : this.data[i][j]);
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

        var tableHead = $('#table-importSettings thead tr').empty();
        for (i=0; i < numCols; i++) {
            var select = $('<select />');
            // Add all the options for the current scantron
            $(this.getHeadersFromConfig()).each(function(j, item) {
                var option = $('<option value="'+item+'">'+item+'</option>');
                // Select the ith item on the list
                if (j === i) {
                    option.attr('selected', true);
                }
                select.append(option);
            });
            select.append('<option value="nouse">Don\'t Use</option>');
            select.addClass('col-'+i);

            tableHead.append($('<th />').append(select));
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
