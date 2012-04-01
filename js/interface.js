var studentList, importDialog;
$(document).ready(function() {
    // Set up the drag and drop
    var dropbox = document.getElementById("dropbox");
    dropbox.addEventListener("dragenter", dragEnter, false);
    dropbox.addEventListener("dragexit", dragExit, false);
    dropbox.addEventListener("dragover", dragOver, false);
    dropbox.addEventListener("drop", drop, false);


    $('.button').button();
    $('#tabs').tabs();
/*    studentList = $('#studentListTable').dataTable({
        bPaginate: false,
        sScrollY: '100%',
        bProcessing: true,
    }); */

    importDialog = new ImportDialog;

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

// Creates a dataTables table to display the student list
function StudentList() {
    this._init.apply(this, arguments);
}
StudentList.prototype = {
    _init: function(columns, data) {
        this.columns = $.extend(true, [], columns);
        this.data = $.extend(true, [], data);

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
            sScrollY: '100%',
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
        console.log('clicked')
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
        
        previewData(data);
    }
}


// Creates an import dialog.  This dialog can then be initialized with data
function ImportDialog() {
    this._init.apply(this, arguments);
}
ImportDialog.prototype = {
    _init: function() {
        this.data = [];
        $('#fromRow-importSettings').change(this.rowFromChange.bind(this));
        this.dialog = $('#importDialog').dialog({
            autoOpen: false,
            modal: true,
            buttons: {
                Cancel: this.close.bind(this),
                Import: this.importClick.bind(this)
            }
        });
    },

    open: function() {
        this.dialog.dialog('open');
    },
    
    close: function() {
        this.dialog.dialog('close');
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
        $('#droplabel').html('Drop CSV File');
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
            // TODO: read this from the currently selected scantron
            $(['sudentId', 'name', 'class', 'section']).each(function(j, item) {
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


function populateStudentList(data) {
    importDialog.update(data)
    importDialog.open();
    if (!studentList) {
        throw {'message': 'Error, tried to populate studentList before it was initialized'};
    }
    studentList.fnClearTable();
//    studentList.fnAddData(data);
    $(data).each(function(i,x) {
        if (x.length === 3) {
            studentList.fnAddData([
                x[2], x[1], 'mth100', x[0]
            ]);
        }
    });
}

var scantronBackgroundImage = new Image(1100, 850);
scantronBackgroundImage.src = 'images/scantron-small.jpg';
function previewData(data) {
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
        var st = new Scantron(SCANTRON_LAYOUT);
        st.fillPdf(data, canvasPdf);

        ctx.restore();

    }
}


// Decode dataURI
function decodeDataURI(dataURI) {
	var
		content = dataURI.indexOf(",")
		,meta = dataURI.substr(5, content).toLowerCase()
		// 'data:'.length == 5
		,data = decodeURIComponent(dataURI.substr(content + 1))
	;
	
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
        console.log(evt.target.result)
        var data = decodeDataURI(evt.target.result);
        console.log(data)
        //document.getElementById("droplabel").innerHTML = data;
        var parsed = CSVToArray(data);
        console.log(parsed)
        populateStudentList(parsed);
}
