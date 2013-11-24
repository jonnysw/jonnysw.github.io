
(function(global) {

	var _initialised;

	/* 
	 * Make a call to google spreadsheet api to get data and build a table
	 */
	function getData() {

		// hardcode the url for now
		var url = 'https://spreadsheets.google.com/feeds/cells/tmIWQ1aR91xPJOk7niwIC-w/od6/public/values?alt=json',
			content = $('.content');

		// get the spreadsheet data via ajax
		request = $.ajax({
			url: url,
			cache: false,
			dataType: 'json'
		});

		// build the table if/when we get our data
		request.done(function( data ) {
      		table = buildTable(data);
      		// add the table to the dialog content
			content.html(table);
  		});

		// somethign went wrong
  		request.fail(function( jqXHR, textStatus ) {
			content.html("Request failed: " + textStatus)
		});
	}

	/* 
	 * Build a html table from the given json data feed
	 */
	function buildTable(json) {

		var feed_data = json.feed.entry,
			col_count = parseInt(json.feed.gs$colCount.$t),
			table, header, body = '',
			i, j,
			row_type_class, data_type_class, pecentage_class,
			sort_value, col_n,
			data;

		// build the table header
		table = '<div class="table">';
		header = '<div class="table_header">';
		for (i = 0; i < col_count; i++) {
			// get the contents of each column header
			data = feed_data[i].content.$t;

			// the json doesn't hold the column data type for headers,
			// so default the first two headers to alpha and the rest to numeric for now
			data_type_class = i <= 1 ? 'alpha' : 'numeric';
			col_n = 'col_'+i;

			// add everything to the column header
			header += '<div class="table_header_cell '+col_n+' '+data_type_class+' sort_asc">'
			header += '<span>'+data+'</span></div>';
		};
		header += '</div>';

		// build the table body, one row at a time
		// (i should be at the first entry in the second row by now)
		for (; i < feed_data.length; i+=col_count) {
			// check if we are on an odd or even row
			row_type_class = feed_data[i].gs$cell.row % 2 === 1 ? 'odd' : '';

			// start the row
			body += '<div class="table_row '+ row_type_class +'">';

			// get the data for each cell on this row
			for (j = 0; j < col_count; j++) {
				// set the col class
				col_n = 'col_'+j;
				// get the formatted content from the feed
				data = feed_data[i+j].content.$t;
				// check if we have alpha or numeric data in this cell for the data type alignment class
				data_type_class =  feed_data[i+j].gs$cell.numericValue !== undefined ? 'numeric' : 'alpha';
				// store the sortable value (use the numericValue from the feed if it exists, as this
				// doesn't include formatting like %, £ etc.)
				sort_value =  feed_data[i+j].gs$cell.numericValue !== undefined ? feed_data[i+j].gs$cell.numericValue : data;
				// check if we have the data is a percentage (and if it is positive or negative)
				pecentage_class = checkPercentage(data);
				// if the data is numeric, then we want to add trailing zeros to 2db
				// where google's feed has removed them
				if (data_type_class == "numeric") {
					data = formatNumbers(data);
				}

				// add everything to this cell
				body += '<div class="table_cell '+col_n+' '+data_type_class+' '+pecentage_class+'" sortValue="'+sort_value+'">'+data+'</div>';
			};
			body += '</div>';
		};

		// bring it all together
		table += header + body + '</div>';
		return table;
	}

	/* 
	 * Check if data looks like a percentage and if
	 * true, return either 'positive' or 'negative'.
	 * Returns an empty string if not a percentage
	 */
	function checkPercentage(data) {

		var re = /^(-?[0-9]*\.?[0-9][0-9]?)%$/,
			ret;

		// use a basic regex to check if data looks like a percentage
		ret = data.match(re);
		
		if (ret) {
			// if we have a percentage, check if it is positive or negative
			if (ret[1] >= 0) {
				return "positive"
			} else {
				return "negative"
			}
		} else {
			return ""
		}
	}

	/* 
	 * Carry out basic checks on 'numeric' strings to check if 
	 * they have 2 decimal places. If not, format the string as neccassery.
	 *
	 * Note: this is not comprehensive and will need to be extended
	 * to support other formats (e.g other currencies)
	 */
	function formatNumbers(data) {

		// look for numbers without any decimal places
		if (data.match(/^[0-9]*$/)) {
			return data += ".00";
		}
		// look for numbers with a single decimal place
		if (data.match(/^[0-9]*\.[0-9]$/)) {
			return data += "0";
		}
		// look for british currencies with out any decimal places
		if (data.match(/^\xA3[0-9]*$/)) {
			return data += ".00";
		}
		// look for precentages with no decimal places
		if (data.match(/^[0-9]*\%$/)) {
			return data.replace(/\%$/, ".00%");
		}
		// look for percentages with only a single decimal place
		if (data.match(/\.[0-9]\%$/)) {
			return data.replace(/\%$/, "0%");
		}

		return data;
	}

	/* 
	 * Bind event handles to the document
	 */
	function bindEventHandlers() {

		// bind event handlers to the document so we don't have to worry about
		// whether they exist yet
		$(document)

			// sort event for table header click
			.on('click', '.table_header_cell', function(e) {
				tableSort(e);
			})

			// on hover events for highlighting table columns
			.on('mouseenter', '.table_cell', function() {
				var classes, col_n;
				// get all the classes
				classes = $(this).attr('class').split(/\s+/);
				// find the col_ class within this list
				// (could use a regex to find it, but this is quicker and we know
				// it'll always be the second class)
				var col_n = classes[1];
				$('.'+col_n).addClass("col_hover");
				$(this).addClass("cell_hover");
			})
			.on('mouseleave', '.table_cell', function() {
				var classes, col_class;
				
				classes = $(this).attr('class').split(/\s+/);
				col_class = classes[1];
				$('.'+col_class).removeClass("col_hover cell_hover");
			});
	}

	/* 
	 * Perform a table sort based on the values in the column
	 * of the clicked event
	 */
	function tableSort(e) {

		var table = $('.table'),
			rows = table.children('.table_row'),
			sort_col = $(e.currentTarget),
			sort_index = sort_col.index(),
			sort_dir = sort_col.hasClass('sort_asc') ? 1 : -1;

		// toggle the sort direction on the clicked column
		sort_col.toggleClass('sort_asc sort_desc');
		// remove the sort_by class from whichever column had it previously
		$('.table_header_cell').removeClass('sort_by');
		// add the sort_by class to the clicked column
		sort_col.addClass('sort_by');

		// do the sorting
		rows.sort(_tableSort(sort_index, sort_dir));

		// replace the table rows with the sorted version and redo
		// the 'odd' row classes
		table.remove('.table_row');
		for (var i = 0; i < rows.length; i++) {
			rows[i].classList.remove('odd');

			if (i % 2 == 1) {
				rows[i].classList.add('odd');
			}
			table.append(rows[i]);
		};
	}

	/* 
	 * Sort callback:
	 * Sort by the sortValue attribute of the element at the given index
	 */
	function _tableSort(index, sort_dir) {

		return function(_a, _b) {
			// get the sort value from the sortValue attribute
			_a = $(_a.children[index]).attr('sortValue');
			_b = $(_b.children[index]).attr('sortValue');
			// the sort value attriubute is stored as a string, so force the type
			// treat all numeric values as floats
			// lowercase to sort A..z as opposed to A..Z..a..z
			_a = $.isNumeric(_a) ? parseFloat(_a) : _a.toLowerCase();
			_b = $.isNumeric(_b) ? parseFloat(_b) : _b.toLowerCase();

			if((_a == null && _b != null) || (_b != null && _a < _b)) return -sort_dir;
			if(_a == _b) return 0;
			return sort_dir;
		}
	};


	global.Datagrid = {
		init : function() {
			if (_initialised) return;
			getData.call(this);
			bindEventHandlers.call(this);
			_initialised = true;
		}
	}

})(window);

// Initialise when ready
$(document).ready(function() {
     Datagrid.init();
});






        