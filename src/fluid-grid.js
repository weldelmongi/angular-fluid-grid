'use strict';

angular.module('fluidGrid', [])

.constant('fluidGridConfig', {
	columns: 6, // number of columns in the grid
	pushing: true, // whether to push other items out of the way
	floating: true, // whether to automatically float items up so they stack
	width: 'auto', // the width of the grid. "auto" will expand the grid to its parent container
	colWidth: 'auto', // the width of the columns. "auto" will divide the width of the grid evenly among the columns
	rowHeight: 'match', // the height of the rows. "match" will set the row height to be the same as the column width
	margins: [10, 10], // the margins in between grid items
	outerMargin: true,
	isMobile: false, // toggle mobile view
	minColumns: 1, // the minimum amount of columns the grid can scale down to
	minRows: 1, // the minimum amount of rows to show if the grid is empty
	maxRows: 100, // the maximum amount of rows in the grid
	defaultSizeX: 2, // the default width of a item
	defaultSizeY: 1, // the default height of a item
	mobileBreakPoint: 600, // the width threshold to toggle mobile mode
	resizable: {
		enabled: true,
		handles: ['s', 'e', 'n', 'w', 'se', 'ne', 'sw', 'nw']
	},
	draggable: {
		enabled: true
	}
})

.controller('FluidGridCtrl', ['fluidGridConfig',
	function(fluidGridConfig) {

		/**
		 * Create options from fluidGridConfig constant
		 */
		angular.extend(this, fluidGridConfig);

		this.resizable = angular.extend({}, fluidGridConfig.resizable || {});
		this.draggable = angular.extend({}, fluidGridConfig.draggable || {});

		/**
		 * A positional array of the items in the grid
		 */
		this.grid = [];

		/**
		 * Clean up after yourself
		 */
		this.destroy = function() {
			this.grid.length = 0;
			this.grid = null;
		};

		/**
		 * Overrides default options
		 *
		 * @param {object} options The options to override
		 */
		this.setOptions = function(options) {
			if (!options) {
				return;
			}

			options = angular.extend({}, options);

			if (options.draggable) {
				angular.extend(this.draggable, options.draggable);
				delete(options.draggable);
			}
			if (options.resizable) {
				angular.extend(this.resizable, options.resizable);
				delete(options.resizable);
			}

			angular.extend(this, options);

			if (!this.margins || this.margins.length !== 2) {
				this.margins = [0, 0];
			} else {
				for (var x = 0, l = this.margins.length; x < l; ++x) {
					this.margins[x] = parseInt(this.margins[x], 10);
					if (isNaN(this.margins[x])) {
						this.margins[x] = 0;
					}
				}
			}
		};

		/**
		 * Check if item can occupy a specified position in the grid
		 *
		 * @param {object} item The item in question
		 * @param {number} row The row index
		 * @param {number} column The column index
		 * @returns {boolean} True if if item fits
		 */
		this.canItemOccupy = function(item, row, column) {
			return row > -1 && column > -1 && item.sizeX + column <= this.columns;
		};

		/**
		 * Set the item in the first suitable position
		 *
		 * @param {object} item The item to insert
		 */
		this.autoSetItemPosition = function(item) {
			// walk through each row and column looking for a place it will fit
			for (var rowIndex = 0; rowIndex < this.maxRows; ++rowIndex) {
				for (var colIndex = 0; colIndex < this.columns; ++colIndex) {
					// only insert if position is not already taken and it can fit
					var items = this.getItems(rowIndex, colIndex, item.sizeX, item.sizeY, item);
					if (items.length === 0 && this.canItemOccupy(item, rowIndex, colIndex)) {
						this.putItem(item, rowIndex, colIndex);
						return;
					}
				}
			}
			throw new Error('Unable to place item!');
		};

		/**
		 * Gets items at a specific coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {number} sizeX
		 * @param {number} sizeY
		 * @param {array} excludeItems An array of items to exclude from selection
		 * @returns {array} Items that match the criteria
		 */
		this.getItems = function(row, column, sizeX, sizeY, excludeItems) {
			var items = [];
			if (!sizeX || !sizeY) {
				sizeX = sizeY = 1;
			}
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			for (var h = 0; h < sizeY; ++h) {
				for (var w = 0; w < sizeX; ++w) {
					var item = this.getItem(row + h, column + w, excludeItems);
					if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && items.indexOf(item) === -1) {
						items.push(item);
					}
				}
			}
			return items;
		};

		/**
		 * Removes an item from the grid
		 *
		 * @param {object} item
		 */
		this.removeItem = function(item) {
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				var index = columns.indexOf(item);
				if (index !== -1) {
					columns[index] = null;
					break;
				}
			}
			this.floatItemsUp();
			this.updateHeight();
		};

		/**
		 * Returns the item at a specified coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {array} excludeitems Items to exclude from selection
		 * @returns {object} The matched item or null
		 */
		this.getItem = function(row, column, excludeItems) {
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			var sizeY = 1;
			while (row > -1) {
				var sizeX = 1,
					col = column;
				while (col > -1) {
					var items = this.grid[row];
					if (items) {
						var item = items[col];
						if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && item.sizeX >= sizeX && item.sizeY >= sizeY) {
							return item;
						}
					}
					++sizeX;
					--col;
				}
				--row;
				++sizeY;
			}
			return null;
		};

		/**
		 * Insert an array of items into the grid
		 *
		 * @param {array} items An array of items to insert
		 */
		this.putItems = function(items) {
			for (var i = 0, l = items.length; i < l; ++i) {
				this.putItem(items[i]);
			}
		};

		/**
		 * Insert a single item into the grid
		 *
		 * @param {object} item The item to insert
		 * @param {number} row (Optional) Specifies the items row index
		 * @param {number} column (Optional) Specifies the items column index
		 * @param {array} ignoreItems
		 */
		this.putItem = function(item, row, column, ignoreItems) {
			if (typeof row === 'undefined' || row === null) {
				row = item.row;
				column = item.col;
				if (typeof row === 'undefined' || row === null) {
					this.autoSetItemPosition(item);
					return;
				}
			}
			if (!this.canItemOccupy(item, row, column)) {
				column = Math.min(this.columns - item.sizeX, Math.max(0, column));
				row = Math.max(0, row);
			}

			if (item && item.oldRow !== null && typeof item.oldRow !== 'undefined') {
				if (item.oldRow === row && item.oldColumn === column) {
					item.row = row;
					item.col = column;
					return;
				} else {
					// remove from old position
					var oldRow = this.grid[item.oldRow];
					if (oldRow && oldRow[item.oldColumn] === item) {
						delete oldRow[item.oldColumn];
					}
				}
			}

			item.oldRow = item.row = row;
			item.oldColumn = item.col = column;

			this.moveOverlappingItems(item, ignoreItems);

			if (!this.grid[row]) {
				this.grid[row] = [];
			}
			this.grid[row][column] = item;
		};

		/**
		 * Prevents items from being overlapped
		 *
		 * @param {object} item The item that should remain
		 * @param {array} ignoreItems
		 */
		this.moveOverlappingItems = function(item, ignoreItems) {
			if (ignoreItems) {
				if (ignoreItems.indexOf(item) === -1) {
					ignoreItems = ignoreItems.slice(0);
					ignoreItems.push(item);
				}
			} else {
				ignoreItems = [item];
			}
			var overlappingItems = this.getItems(
				item.row,
				item.col,
				item.sizeX,
				item.sizeY,
				ignoreItems
			);
			this.moveItemsDown(overlappingItems, item.row + item.sizeY, ignoreItems);
		};

		/**
		 * Moves an array of items to a specified row
		 *
		 * @param {array} items The items to move
		 * @param {number} newRow The target row
		 * @param {array} ignoreItems
		 */
		this.moveItemsDown = function(items, newRow, ignoreItems) {
			if (!items || items.length === 0) {
				return;
			}
			items.sort(function(a, b) {
				return a.row - b.row;
			});
			ignoreItems = ignoreItems ? ignoreItems.slice(0) : [];
			var topRows = {},
				item, i, l;
			// calculate the top rows in each column
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var topRow = topRows[item.col];
				if (typeof topRow === 'undefined' || item.row < topRow) {
					topRows[item.col] = item.row;
				}
			}
			// move each item down from the top row in its column to the row
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var rowsToMove = newRow - topRows[item.col];
				this.moveItemDown(item, item.row + rowsToMove, ignoreItems);
				ignoreItems.push(item);
			}
		};

		this.moveItemDown = function(item, newRow, ignoreItems) {
			if (item.row >= newRow) {
				return;
			}
			while (item.row < newRow) {
				++item.row;
				this.moveOverlappingItems(item, ignoreItems);
			}
			this.putItem(item, item.row, item.col, ignoreItems);
		};

		/**
		 * Moves all items up as much as possible
		 */
		this.floatItemsUp = function() {
			if (this.floating === false) {
				return;
			}
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						this.floatItemUp(columns[colIndex]);
					}
				}
			}
		};

		/**
		 * Float an item up to the most suitable row
		 *
		 * @param {object} item The item to move
		 */
		this.floatItemUp = function(item) {
			var colIndex = item.col,
				sizeY = item.sizeY,
				sizeX = item.sizeX,
				bestRow = null,
				bestColumn = null,
				rowIndex = item.row - 1;

			while (rowIndex > -1) {
				var items = this.getItems(rowIndex, colIndex, sizeX, sizeY, item);
				if (items.length !== 0) {
					break;
				}
				bestRow = rowIndex;
				bestColumn = colIndex;
				--rowIndex;
			}
			if (bestRow !== null) {
				this.putItem(item, bestRow, bestColumn);
			}
		};

		/**
		 * Update gridsters height
		 *
		 * @param {number} plus (Optional) Additional height to add
		 */
		this.updateHeight = function(plus) {
			var maxHeight = this.minRows;
			if (!plus) {
				plus = 0;
			}
			for (var rowIndex = this.grid.length; rowIndex >= 0; --rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						maxHeight = Math.max(maxHeight, rowIndex + plus + columns[colIndex].sizeY);
					}
				}
			}
			//this.gridHeight = Math.min(this.maxRows, maxHeight);
			// angular-gridster issue #99
			this.gridHeight = this.maxRows - maxHeight > 0 ? Math.min(this.maxRows, maxHeight) : Math.max(this.maxRows, maxHeight);
		};

		/**
		 * Returns the number of rows that will fit in given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 */
		this.pixelsToRows = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.curRowHeight);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.curRowHeight);
			}

			return Math.round(pixels / this.curRowHeight);
		};

		/**
		 * Returns the number of columns that will fit in a given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 * @returns {number} The number of columns
		 */
		this.pixelsToColumns = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.curColWidth);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.curColWidth);
			}

			return Math.round(pixels / this.curColWidth);
		};

	}
])

/**
 * The fluidGrid directive
 *
 * @param {object} $parse
 * @param {object} $timeout
 */
.directive('fluidGrid', ['$timeout', '$rootScope', '$window',
	function($timeout, $rootScope, $window) {
		return {
			restrict: 'EAC',
			// without transclude, some child items may lose their parent scope
			transclude: true,
			replace: true,
			template: '<div ng-class="fluidGridClass()"><div ng-style="previewStyle()" class="fluid-grid-item fluid-grid-preview-holder"></div><div ng-transclude></div></div>',
			controller: 'FluidGridCtrl',
			controllerAs: 'fluidGrid',
			scope: {
				config: '=?fluidGrid'
			},
			compile: function() {

				return function(scope, $elem, attrs, fluidGrid) {
					fluidGrid.loaded = false;

					scope.fluidGridClass = function() {
						return {
							'fluid-grid': true,
							'fluid-grid-desktop': !fluidGrid.isMobile,
							'fluid-grid-mobile': fluidGrid.isMobile,
							'fluid-grid-loaded': fluidGrid.loaded
						};
					};

					/**
					 * @returns {Object} style object for preview element
					 */
					scope.previewStyle = function() {
						if (!fluidGrid.movingItem) {
							return {
								display: 'none'
							};
						}

						return {
							display: 'block',
							height: (fluidGrid.movingItem.sizeY * fluidGrid.curRowHeight - fluidGrid.margins[0]) + 'px',
							width: (fluidGrid.movingItem.sizeX * fluidGrid.curColWidth - fluidGrid.margins[1]) + 'px',
							top: (fluidGrid.movingItem.row * fluidGrid.curRowHeight + (fluidGrid.outerMargin ? fluidGrid.margins[0] : 0)) + 'px',
							left: (fluidGrid.movingItem.col * fluidGrid.curColWidth + (fluidGrid.outerMargin ? fluidGrid.margins[1] : 0)) + 'px'
						};
					};

					var refresh = function() {
						fluidGrid.setOptions(scope.config);

						// resolve "auto" & "match" values
						if (fluidGrid.width === 'auto') {
							fluidGrid.curWidth = parseInt($elem.css('width')) ||  parseInt($elem.prop('offsetWidth'));
						} else {
							fluidGrid.curWidth = fluidGrid.width;
						}
						if (fluidGrid.colWidth === 'auto') {
							fluidGrid.curColWidth = parseInt((fluidGrid.curWidth + (fluidGrid.outerMargin ? -fluidGrid.margins[1] : fluidGrid.margins[1])) / fluidGrid.columns);
						} else {
							fluidGrid.curColWidth = fluidGrid.colWidth;
						}
						if (fluidGrid.rowHeight === 'match') {
							fluidGrid.curRowHeight = fluidGrid.curColWidth;
						} else {
							fluidGrid.curRowHeight = fluidGrid.rowHeight;
						}

						fluidGrid.isMobile = fluidGrid.curWidth <= fluidGrid.mobileBreakPoint;

						// loop through all items and reset their CSS
						for (var rowIndex = 0, l = fluidGrid.grid.length; rowIndex < l; ++rowIndex) {
							var columns = fluidGrid.grid[rowIndex];
							if (!columns) {
								continue;
							}
							for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
								if (columns[colIndex]) {
									var item = columns[colIndex];
									item.setElementPosition();
									item.setElementSizeY();
									item.setElementSizeX();
								}
							}
						}

						updateHeight();
					};

					// update grid items on config changes
					scope.$watch('config', refresh, true);

					scope.$watch('config.draggable', function() {
						$rootScope.$broadcast('fluid-grid-draggable-changed');
					}, true);

					scope.$watch('config.resizable', function() {
						$rootScope.$broadcast('fluid-grid-resizable-changed');
					}, true);

					var updateHeight = function() {
						//$elem.css('height', (fluidGrid.gridHeight * fluidGrid.curRowHeight) + fluidGrid.margins[0] + 'px');
						$elem.css('height', (fluidGrid.gridHeight * fluidGrid.curRowHeight) + (fluidGrid.outerMargin ? fluidGrid.margins[0] : -fluidGrid.margins[0]) + 'px');
					};

					scope.$watch('fluidGrid.gridHeight', updateHeight);

					var prevWidth = parseFloat($elem.css('width')) || $elem.prop('offsetWidth');

					function resize() {
						var width = parseFloat($elem.css('width')) || $elem.prop('offsetWidth');

						if (width === prevWidth || fluidGrid.movingItem) {
							return;
						}
						prevWidth = width;

						if (fluidGrid.loaded) {
							$elem.removeClass('fluid-grid-loaded');
						}

						refresh();

						if (fluidGrid.loaded) {
							$elem.addClass('fluid-grid-loaded');
						}

					}

					// track element width changes any way we can
					function onResize() {
						resize();
						$timeout(function() {
							scope.$apply();
						});
					}
					if (typeof $elem.resize === 'function') {
						$elem.resize(onResize);
					}
					var $win = angular.element($window);
					$win.on('resize', onResize);

					scope.$watch(function() {
						var _width = parseFloat($elem.css('width')) || $elem.prop('offsetWidth');
						return _width;
					}, resize);

					// be sure to cleanup
					scope.$on('$destroy', function() {
						fluidGrid.destroy();
						$win.off('resize', onResize);
					});

					// allow a little time to place items before floating up
					$timeout(function() {
						scope.$watch('fluidGrid.floating', function() {
							fluidGrid.floatItemsUp();
						});
						fluidGrid.loaded = true;
					}, 100);
				};
			}
		};
	}
])

.controller('FluidGridItemCtrl', function() {
	this.$element = null;
	this.fluidGrid = null;
	this.row = null;
	this.col = null;
	this.sizeX = null;
	this.sizeY = null;

	this.init = function($element, fluidGrid) {
		this.$element = $element;
		this.fluidGrid = fluidGrid;
		this.sizeX = fluidGrid.defaultSizeX;
		this.sizeY = fluidGrid.defaultSizeY;
	};

	this.destroy = function() {
		this.fluidGrid = null;
		this.$element = null;
	};

	/**
	 * Returns the items most important attributes
	 */
	this.toJSON = function() {
		return {
			row: this.row,
			col: this.col,
			sizeY: this.sizeY,
			sizeX: this.sizeX
		};
	};

	this.isMoving = function() {
		return this.fluidGrid.movingItem === this;
	};

	/**
	 * Set the items position
	 *
	 * @param {number} row
	 * @param {number} column
	 */
	this.setPosition = function(row, column) {
		this.fluidGrid.putItem(this, row, column);
		if (this.fluidGrid.loaded) {
			this.fluidGrid.floatItemsUp();
		}

		this.fluidGrid.updateHeight(this.isMoving() ? this.sizeY : 0);

		if (!this.isMoving()) {
			this.setElementPosition();
		}
	};

	/**
	 * Sets a specified size property
	 *
	 * @param {string} key Can be either "x" or "y"
	 * @param {number} value The size amount
	 */
	this.setSize = function(key, value) {
		key = key.toUpperCase();
		var camelCase = 'size' + key,
			titleCase = 'Size' + key;
		if (value === '') {
			return;
		}
		value = parseInt(value, 10);
		if (isNaN(value) || value === 0) {
			value = this.fluidGrid['default' + titleCase];
		}
		var changed = !(this[camelCase] === value && this['old' + titleCase] && this['old' + titleCase] === value);
		this['old' + titleCase] = this[camelCase] = value;

		if (!this.isMoving()) {
			this['setElement' + titleCase]();
		}
		if (changed) {
			this.fluidGrid.moveOverlappingItems(this);

			if (this.fluidGrid.loaded) {
				this.fluidGrid.floatItemsUp();
			}

			this.fluidGrid.updateHeight(this.isMoving() ? this.sizeY : 0);
		}
	};

	/**
	 * Sets the items sizeY property
	 *
	 * @param {number} rows
	 */
	this.setSizeY = function(rows) {
		this.setSize('y', rows);
	};

	/**
	 * Sets the items sizeX property
	 *
	 * @param {number} rows
	 */
	this.setSizeX = function(columns) {
		this.setSize('x', columns);
	};

	/**
	 * Sets an elements position on the page
	 *
	 * @param {number} row
	 * @param {number} column
	 */
	this.setElementPosition = function() {
		if (this.fluidGrid.isMobile) {
			this.$element.css({
				margin: this.fluidGrid.margins[0] + 'px',
				top: 'auto',
				left: 'auto'
			});
		} else {
			this.$element.css({
				margin: 0 + 'px',
				top: (this.row * this.fluidGrid.curRowHeight + (this.fluidGrid.outerMargin ? this.fluidGrid.margins[0] : 0)) + 'px',
				left: (this.col * this.fluidGrid.curColWidth + (this.fluidGrid.outerMargin ? this.fluidGrid.margins[1] : 0)) + 'px'
			});
		}
	};

	/**
	 * Sets an elements height
	 */
	this.setElementSizeY = function() {
		if (this.fluidGrid.isMobile) {
			this.$element.css('height', '');
		} else {
			this.$element.css('height', (this.sizeY * this.fluidGrid.curRowHeight - this.fluidGrid.margins[0]) + 'px');
		}
	};

	/**
	 * Sets an elements width
	 */
	this.setElementSizeX = function() {
		if (this.fluidGrid.isMobile) {
			this.$element.css('width', 'auto');
		} else {
			this.$element.css('width', (this.sizeX * this.fluidGrid.curColWidth - this.fluidGrid.margins[1]) + 'px');
		}
	};
})

/**
 * GridyItem directive
 *
 * @param {object} $parse
 * @param {object} $controller
 * @param {object} $timeout
 */
.directive('fluidGridItem', ['$parse', '$compile', '$document',
	function($parse, $compile, $document) {
		return {
			restrict: 'EA',
			controller: 'FluidGridItemCtrl',
			require: ['^fluidGrid', 'fluidGridItem'],
			link: function(scope, $el, attrs, controllers) {
				var optionsKey = attrs.fluidGridItem,
					options; // this is the item's model.

				var fluidGrid = controllers[0],
					item = controllers[1];

				//bind the items position properties
				if (optionsKey) {
					var $optionsGetter = $parse(optionsKey);
					options = $optionsGetter(scope) || {};

					if (!options && $optionsGetter.assign) {
						options = {
							row: item.row,
							col: item.col,
							sizeX: item.sizeX,
							sizeY: item.sizeY
						};
						$optionsGetter.assign(scope, options);
					}
				} else {
					options = attrs;
				}

				item.init($el, fluidGrid);

				$el.addClass('fluid-grid-item');


				function setDraggable() {
					var elmX, elmY, elmW, elmH,

						mouseX = 0,
						mouseY = 0,
						lastMouseX = 0,
						lastMouseY = 0,
						mOffX = 0,
						mOffY = 0,

						minTop = 0,
						maxTop = 9999,
						minLeft = 0,
						maxLeft = fluidGrid.curWidth - 1;

					var originalCol, originalRow;

					function mouseDown(e) {
						if (e.currentTarget !== e.target) {
							return;
						}

						lastMouseX = e.pageX;
						lastMouseY = e.pageY;

						elmX = parseInt($el.css('left'));
						elmY = parseInt($el.css('top'));
						elmW = parseInt($el.css('width'));
						elmH = parseInt($el.css('height'));

						originalCol = item.col;
						originalRow = item.row;

						dragStart(e);

						$document.bind('mousemove', mouseMove);
						$document.bind('mouseup', mouseUp);

						e.preventDefault();
						e.stopPropagation();
					}

					function mouseMove(e) {
						// Get the current mouse position.
						mouseX = e.pageX;
						mouseY = e.pageY;

						// Get the deltas
						var diffX = mouseX - lastMouseX + mOffX;
						var diffY = mouseY - lastMouseY + mOffY;
						mOffX = mOffY = 0;

						// Update last processed mouse positions.
						lastMouseX = mouseX;
						lastMouseY = mouseY;

						var dX = diffX,
							dY = diffY;
						if (elmX + dX < minLeft) {
							diffX = minLeft - elmX;
							mOffX = dX - diffX;
						} else if (elmX + elmW + dX > maxLeft) {
							diffX = maxLeft - elmX - elmW;
							mOffX = dX - diffX;
						}

						if (elmY + dY < minTop) {
							diffY = minTop - elmY;
							mOffY = dY - diffY;
						} else if (elmY + elmH + dY > maxTop) {
							diffY = maxTop - elmY - elmH;
							mOffY = dY - diffY;
						}
						elmX += diffX;
						elmY += diffY;

						// set new position
						$el.css({
							'top': elmY + 'px',
							'left': elmX + 'px'
						});

						drag(e);

						e.stopPropagation();
						e.preventDefault();
					}

					function mouseUp(e) {
						$document.unbind('mouseup', mouseUp);
						$document.unbind('mousemove', mouseMove);

						mOffX = mOffY = 0;

						dragStop(e);
					}

					function dragStart(event) {
						$el.addClass('fluid-grid-item-moving');
						fluidGrid.movingItem = item;

						fluidGrid.updateHeight(item.sizeY);
						scope.$apply(function() {
							if (fluidGrid.draggable && fluidGrid.draggable.start) {
								fluidGrid.draggable.start(event, $el, options);
							}
						});
					}

					function drag(event) {
						item.row = fluidGrid.pixelsToRows(elmY);
						item.col = fluidGrid.pixelsToColumns(elmX);

						scope.$apply(function() {
							if (fluidGrid.draggable && fluidGrid.draggable.drag) {
								fluidGrid.draggable.drag(event, $el, options);
							}
						});
					}

					function dragStop(event) {
						$el.removeClass('fluid-grid-item-moving');
						var row = fluidGrid.pixelsToRows(elmY);
						var col = fluidGrid.pixelsToColumns(elmX);
						if (fluidGrid.pushing !== false || fluidGrid.getItems(row, col, item.sizeX, item.sizeY, item).length === 0) {
							item.row = row;
							item.col = col;
						}
						fluidGrid.movingItem = null;

						var itemMoved = (originalCol !== item.col || originalRow !== item.row);

						scope.$apply(function() {
							// callback only if item really changed position
							if (itemMoved && fluidGrid.draggable && fluidGrid.draggable.stop) {
								fluidGrid.draggable.stop(event, $el, options);
							}
						});

						item.setPosition(item.row, item.col);
						fluidGrid.updateHeight();
					}

					var dragHandle = $el;

					if (fluidGrid.draggable.enabled) {
						if (fluidGrid.draggable.handle) {
							dragHandle = $el.find(fluidGrid.draggable.handle);
						}

						dragHandle.bind('mousedown', mouseDown);
					} else {
						if (fluidGrid.draggable.handle) {
							dragHandle = $el.find(fluidGrid.draggable.handle);
						}
						dragHandle.unbind('mousedown');
					}

				}


				function setResizable() {

					fluidGrid.resizable.handles.forEach(function(handleClass) {

						var hClass = handleClass;

						var elmX, elmY, elmW, elmH,

							mouseX = 0,
							mouseY = 0,
							lastMouseX = 0,
							lastMouseY = 0,
							mOffX = 0,
							mOffY = 0,

							minTop = 0,
							maxTop = 9999,
							minLeft = 0,
							maxLeft = fluidGrid.curWidth - 1;


						var minHeight = fluidGrid.curRowHeight - fluidGrid.margins[0],
							minWidth = fluidGrid.curColWidth - fluidGrid.margins[1];

						var originalWidth, originalHeight;

						function mouseDown(e) {
							// Get the current mouse position. 
							lastMouseX = e.pageX;
							lastMouseY = e.pageY;

							// Record current widget dimensions
							elmX = parseInt($el.css('left'));
							elmY = parseInt($el.css('top'));
							elmW = parseInt($el.css('width'));
							elmH = parseInt($el.css('height'));

							originalWidth = item.sizeX;
							originalHeight = item.sizeY;

							resizeStart(e);

							$document.bind('mousemove', mouseMove);
							$document.bind('mouseup', mouseUp);

							e.preventDefault();
							e.stopPropagation();
						}

						function resizeStart(e) {
							$el.addClass('fluid-grid-item-moving');

							fluidGrid.movingItem = item;

							item.setElementSizeX();
							item.setElementSizeY();
							item.setElementPosition();

							scope.$apply(function() {
								// callback
								if (fluidGrid.resizable && fluidGrid.resizable.start) {
									fluidGrid.resizable.start(e, $el, options); // options is the item model
								}
							});

						}

						function mouseMove(e) {
							// Get the current mouse position.
							mouseX = e.pageX;
							mouseY = e.pageY;

							// Get the deltas
							var diffX = mouseX - lastMouseX + mOffX;
							var diffY = mouseY - lastMouseY + mOffY;
							mOffX = mOffY = 0;

							// Update last processed mouse positions.
							lastMouseX = mouseX;
							lastMouseY = mouseY;

							var dY = diffY,
								dX = diffX;

							if (hClass.indexOf('n') >= 0) {
								if (elmH - dY < minHeight) {
									diffY = elmH - minHeight;
									mOffY = dY - diffY;
								} else if (elmY + dY < minTop) {
									diffY = minTop - elmY;
									mOffY = dY - diffY;
								}
								elmY += diffY;
								elmH -= diffY;
							}
							if (hClass.indexOf('s') >= 0) {
								if (elmH + dY < minHeight) {
									diffY = minHeight - elmH;
									mOffY = dY - diffY;
								} else if (elmY + elmH + dY > maxTop) {
									diffY = maxTop - elmY - elmH;
									mOffY = dY - diffY;
								}
								elmH += diffY;
							}
							if (hClass.indexOf('w') >= 0) {
								if (elmW - dX < minWidth) {
									diffX = elmW - minWidth;
									mOffX = dX - diffX;
								} else if (elmX + dX < minLeft) {
									diffX = minLeft - elmX;
									mOffX = dX - diffX;
								}
								elmX += diffX;
								elmW -= diffX;
							}
							if (hClass.indexOf('e') >= 0) {
								if (elmW + dX < minWidth) {
									diffX = minWidth - elmW;
									mOffX = dX - diffX;
								} else if (elmX + elmW + dX > maxLeft) {
									diffX = maxLeft - elmX - elmW;
									mOffX = dX - diffX;
								}
								elmW += diffX;
							}

							// set new position
							$el.css({
								'top': elmY + 'px',
								'left': elmX + 'px',
								'width': elmW + 'px',
								'height': elmH + 'px'
							});

							resize(e);

							e.preventDefault();
							e.stopPropagation();
						}

						function mouseUp(e) {
							$document.unbind('mouseup', mouseUp);
							$document.unbind('mousemove', mouseMove);

							mOffX = mOffY = 0;

							resizeStop(e);
						}

						function resize(e) {

							item.row = fluidGrid.pixelsToRows(elmY + fluidGrid.margins[0], false);
							item.col = fluidGrid.pixelsToColumns(elmX + fluidGrid.margins[1], false);
							item.sizeX = fluidGrid.pixelsToColumns(elmW, true);
							item.sizeY = fluidGrid.pixelsToRows(elmH, true);

							scope.$apply(function() {
								// callback
								if (fluidGrid.resizable && fluidGrid.resizable.resize) {
									fluidGrid.resizable.resize(e, $el, options); // options is the item model
								}
							});

						}

						function resizeStop(e) {
							$el.removeClass('fluid-grid-item-moving');

							fluidGrid.movingItem = null;

							item.setPosition(item.row, item.col);
							item.setSizeY(item.sizeY);
							item.setSizeX(item.sizeX);

							var itemResized = (originalWidth !== item.sizeX || originalHeight !== item.sizeY);

							scope.$apply(function() {
								// callback only if item really changed size
								if (itemResized && fluidGrid.resizable && fluidGrid.resizable.stop) {
									fluidGrid.resizable.stop(e, $el, options); // options is the item model
								}
							});

						}

						if (fluidGrid.resizable.enabled) {
							// add handle
							var dragHandle = angular.element('<div class="fluid-grid-item-resizable-handler handle-' + hClass + '"></div>');
							$el.append(dragHandle);

							dragHandle.bind('mousedown', mouseDown);
						} else {
							// remove handles
							var domEl = $document[0].querySelectorAll('.fluid-grid-item-resizable-handler');
							if (domEl.length) {
								angular.element(domEl).remove();
							}
						}

					});

				}

				var aspects = ['sizeX', 'sizeY', 'row', 'col'],
					$getters = {};

				var aspectFn = function(aspect) {
					var key;
					if (typeof options[aspect] === 'string') {
						key = options[aspect];
					} else if (typeof options[aspect.toLowerCase()] === 'string') {
						key = options[aspect.toLowerCase()];
					} else if (optionsKey) {
						key = $parse(optionsKey + '.' + aspect);
					} else {
						return;
					}
					$getters[aspect] = $parse(key);

					// when the value changes externally, update the internal item object
					scope.$watch(key, function(newVal) {
						newVal = parseInt(newVal, 10);
						if (!isNaN(newVal)) {
							item[aspect] = newVal;
						}
					});

					// initial set
					var val = $getters[aspect](scope);
					if (typeof val === 'number') {
						item[aspect] = val;
					}
				};

				for (var i = 0, l = aspects.length; i < l; ++i) {
					aspectFn(aspects[i]);
				}

				function positionChanged() {
					// call setPosition so the element and fluidGrid controller are updated
					item.setPosition(item.row, item.col);

					// when internal item position changes, update externally bound values
					if ($getters.row && $getters.row.assign) {
						$getters.row.assign(scope, item.row);
					}
					if ($getters.col && $getters.col.assign) {
						$getters.col.assign(scope, item.col);
					}
				}
				scope.$watch(
					function() {
						return item.row;
					}, positionChanged);

				scope.$watch(function() {
					return item.col;
				}, positionChanged);

				scope.$on('fluid-grid-draggable-changed', setDraggable);
				scope.$on('fluid-grid-resizable-changed', setResizable);

				setDraggable();
				setResizable();


				scope.$watch(
					function() {
						return item.sizeY;
					},
					function(sizeY) {
						item.setSizeY(sizeY);
						if ($getters.sizeY && $getters.sizeY.assign) {
							$getters.sizeY.assign(scope, item.sizeY);
						}
					}
				);

				scope.$watch(
					function() {
						return item.sizeX;
					},
					function(sizeX) {
						item.setSizeX(sizeX);
						if ($getters.sizeX && $getters.sizeX.assign) {
							$getters.sizeX.assign(scope, item.sizeX);
						}
					}
				);


				return scope.$on('$destroy', function() {
					try {
						fluidGrid.removeItem(item);
					} catch (e) {}
					try {
						item.destroy();
					} catch (e) {}

				});
			}
		};
	}
]);