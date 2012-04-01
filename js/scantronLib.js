"use strict";
/*************************************************
 * scantronLib is where the layout logic for scantron
 * rendering as well as the drawing operations.  scantronLib
 * can render to an jsPDF compatible surface, such as a
 * jsPDF doc, or a CanvasPdf object.
 **************************************************/


// Returns a list where each letter in @string is replaced with
// the corresponding entry in @table.
// @string = a string
// @table = object (e.g. {a: 1, b: 2, c: 3})
function applyTranslationTable(string, table) {
    var ret = [];
    var i;
    for(i = 0; i < string.length; i++) {
        ret.push(table[string.charAt(i)]);
    }
    return ret;
}

// pre-defined translation tables
var TRANSLATION_TABLE_ALPHA = {' ':0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26 };  //{' ':0, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12, m: 13, n: 14, o: 15, p: 16, q: 17, r: 18, s: 19, t: 20, u: 21, v: 22, w: 23, x: 24, y: 25, z: 26 };
var TRANSLATION_TABLE_NUMBER = {'0':0, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9 };
// A pre-defined page layout for a scantron sheet
var SCANTRON_LAYOUT = {
    name: {
        textExtents: [29,213,270,237],
        bubbleExtents: [29,237,270,560], 
        rows: 27,
        cols: 20, 
        layout: 'vertical',
        translationTable: TRANSLATION_TABLE_ALPHA
    },
    studentId: {
        textExtents: [31,56,114,80],
        bubbleExtents: [31,80,114,202], 
        rows: 10,
        cols: 7, 
        layout: 'vertical',
        translationTable: TRANSLATION_TABLE_NUMBER
    },
    section: {
        textExtents: [115,56,175,80],
        bubbleExtents: [115,80,175,202], 
        rows: 10,
        cols: 5, 
        layout: 'vertical',
        translationTable: TRANSLATION_TABLE_NUMBER
    },
}



function Scantron() {
    this._init.apply(this, arguments);
}

Scantron.prototype = {
    _init: function(pageLayout) {
        this.pageLayout = pageLayout;

        var i;
        for (i in this.pageLayout) {
            var curr = this.pageLayout[i];
            this['region_'+i] = new FillRegion(curr.textExtents, curr.bubbleExtents, 
                                               curr.rows, curr.cols, curr.orientation,
                                               curr.translationTable);
        }
    },

    fillPdf: function(data, pdf) {
        var i, curr;
        for (i in data) {
            if(this['region_'+i]) {
                curr = this['region_'+i];
                curr.fillWithText(data[i], pdf);
                curr.drawOutline(pdf);
            }
        }
    }
}

function FillRegion() {
    this._init.apply(this, arguments);
}

FillRegion.prototype = {
    // @textCoords = the coords of the TextRegion
    // @bubbleCoords = the coords of the bubble region
    // @rows = number of rows of bubbles
    // @cols = number of cols of bubbles
    // @orientation = 'horizontal' or 'vertical'
    _init: function(textCoords, bubbleCoords, rows, cols, orientation, translationTable) {
        this.translationTable = translationTable || {' ':0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26 };
        this.orientation = orientation || 'vertical';
        var textCols = this.orientation === 'vertical' ? cols : 1;
        var textRows = this.orientation === 'vertical' ? 1 : rows;
        this.textRegion = new TextRegion(textCoords, textRows, textCols, this.orientation);
        this.bubbleRegion = new BubbleRegion(bubbleCoords, rows, cols, this.orientation);
    },

    fillWithText: function(text, pdf) {
        // we will make the assumption that everything is done in upper case
        text = text.toUpperCase();
        // First write all the text to the pdf document
        var i;
        var letterCoords = this.textRegion.getLetterCoords(text);
        for (i = 0; i < letterCoords.length; i++) {
            pdf.text(letterCoords[i][0], letterCoords[i][1], text.charAt(i));
        }

        // Now, fill in the bubbles
        var translated = applyTranslationTable(text, this.translationTable);
        var bubbleCoords = this.bubbleRegion.getBubbleCoords(translated);
        for (i = 0; i < bubbleCoords.length; i++) {
            pdf.circle(bubbleCoords[i][0], bubbleCoords[i][1], this.bubbleRegion.bubbleRadius, 'F');
        }
    },

    drawOutline: function(pdf) {
        function drawBox(coords) {
            pdf.line(coords[0], coords[1], 
                     coords[2], coords[1]);
            pdf.line(coords[2], coords[1], 
                     coords[2], coords[3]);
            pdf.line(coords[2], coords[3], 
                     coords[0], coords[3]);
            pdf.line(coords[0], coords[1], 
                     coords[0], coords[3]);
        }
        function drawVerticalDividers(coords, num) {
            var width = coords[2] - coords[0];
            var step = width/num;
            var i;
            for (i = 1; i < num; i++) {
                var x = coords[0]+i*step;
                pdf.line(x, coords[1], x, coords[3])
            }
        }

        drawBox(this.textRegion.coords);
        drawVerticalDividers(this.textRegion.coords, this.textRegion.cols)
        drawBox(this.bubbleRegion.coords);
        drawVerticalDividers(this.bubbleRegion.coords, this.bubbleRegion.cols)
    }
}

function TextRegion() {
    this._init.apply(this, arguments);
}

TextRegion.prototype = {
    // @coords = [left, top, right, bottom]
    // @orientation = 'horizontal' or 'vertical'
    _init: function(coords, rows, cols, orientation) {
        this.coords = coords;
        this.rows = rows;
        this.cols = cols;
        this.orientation = orientation || 'vertical';

        this.width = this.coords[2] - this.coords[0];
        this.height = this.coords[3] - this.coords[1];
        this.widthStep = this.width/this.cols;
        this.heightStep = this.width/this.rows;
    },

    getLetterCoords: function(letterList) {
        var ret = [];
        var i;
        if (this.orientation === 'vertical') {
            for (i=0; i < this.cols; i++) {
                if (letterList[i] != null) {
                    var x = this.widthStep*i;
                    var y = this.height;
                    ret.push([this.coords[0] + x,this.coords[1] + y]);
                }
            }
        } else if (this.orientation === 'horizontal') {
            for (i=0; i < this.rows; i++) {
                if (letterList[i] != null) {
                    var x = 0;
                    var y = this.heightStep*(i+1);
                    ret.push([this.coords[0] + x, this.coords[1] + y]);
                }
            }
        } else {
            throw {message: 'Unknown TextRegion orientation \'' + orientation +'\''};
        }

        return ret;
    }
}


function BubbleRegion() {
    this._init.apply(this, arguments);
}

BubbleRegion.prototype = {
    // @coords = [left, top, right, bottom]
    // @orientation = 'horizontal' or 'vertical'
    _init: function(coords, rows, cols, orientation) {
        this.coords = coords;
        this.rows = rows;
        this.cols = cols;
        this.orientation = orientation || 'vertical';

        this.width = this.coords[2] - this.coords[0];
        this.height = this.coords[3] - this.coords[1];
        this.widthStep = this.width/this.cols;
        this.heightStep = this.height/this.rows;
        // The radius of each bubble is the average of the radius derived from the width and the height
        this.bubbleRadius = (this.widthStep + this.heightStep)/4;
    },

    // @letterList is a list of numbers (e.g. [0,0,1,2,3,2,2])
    // that represents which bubble in each column (or row if the layout is horizontal)
    // that should be shaded. A value of null or undefined means no bubble to be shaded in that
    // column.
    getBubbleCoords: function(letterList) {
        var ret = [];
        var i;
        if (this.orientation === 'vertical') {
            for (i=0; i < this.cols; i++) {
                if (letterList[i] != null) {
                    var x = this.widthStep/2 + this.widthStep*i;
                    var y = this.heightStep/2 + this.heightStep*letterList[i];
                    ret.push([this.coords[0] + x,this.coords[1] + y]);
                }
            }
        } else if (this.orientation === 'horizontal') {
            for (i=0; i < this.rows; i++) {
                if (letterList[i] != null) {
                    var x = this.widthStep/2 + this.widthStep*letterList[i];
                    var y = this.heightStep/2 + this.heightStep*i;
                    ret.push([this.coords[0] + x, this.coords[1] + y]);
                }
            }
        } else {
            throw {message: 'Unknown BubbleRegion orientation \'' + orientation +'\''};
        }

        return ret;
    }
}


function testpage1() {
    var doc = new jsPDF('landscape', 'pt', 'letter');

    var st = new Scantron(SCANTRON_LAYOUT);
    st.fillPdf({name:'bilbow baggins', studentId: '12345', section:'041'}, doc);
    // Output as Data URI
    doc.output('datauri');
}
