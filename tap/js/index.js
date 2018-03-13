(function() {

    'use strict';

    var Game = function(options) {
        var board = [];

        this.$el = options.el || $('body');
        this.rows = options.rows || 5;
        this.cols = options.cols || 5;
        this.events = {};
        this.moves = 0;

        if (options.board) {

            if (this.verifyBoardPattern(options.board)) {
                board = this.buildBoardFromPattern(options.board);
                this.rows = board.length;
                this.cols = board[0].length;
            } else {
                console.warn('Board pattern "' + options.board + '" is not valid');
            }
        }

        // If board is empty, use a standard
        if (!board.length) {
            for (var ir = 0; ir < this.rows; ir += 1) {
                board.push([]);

                for (var ic = 0; ic < this.cols; ic += 1) {
                    // false is the default state of a game tile
                    board[ir].push(false);
                }
            }
        }

        this.board = board;

        this.drawBoard();

        if (options.board) {
            this.updateGameBoard();
        }
    };

    _.extend(Game.prototype, {
        setBoard: function(boardPattern) {
            var board;

            if (!this.verifyBoardPattern(boardPattern)) {
                console.warn('Board pattern "' + boardPattern + '" is not valid');

                return;
            }

            board = this.buildBoardFromPattern(boardPattern);

            this.rows = board.length;
            this.cols = board[0].length;

            this.board = board;
            this.moves = 0;

            this.drawBoard();
            this.updateGameBoard();
        },

        /**
         * Adds callbacks to the event object. Each event can have multiple callbacks
         */
        on: function(eventName, callback) {
            if (!this.events[eventName]) {
                this.events[eventName] = [];
            }

            this.events[eventName].push(callback);
        },

        /**
         * Triggers events
         */
        trigger: function(eventName) {
            var triggerArgs,
                events;

            if (arguments.length > 1) {
                triggerArgs = Array.prototype.slice.call(arguments, 1);
            }

            if (this.events[eventName]) {
                events = this.events[eventName];

                _.each(events, function(func) {
                    func.apply(this, triggerArgs);
                }, this);
            }
        },

        /**
         * Removes handlers for an event
         */
        off: function(eventName) {
            if (this.events[eventName]) {
                delete this.events[eventName];
            }
        },
      
        /**
         * Unbinds all click handlers for tiles
         */
        deactivate: function() {
            this.$el.off();
            this.$el.find('.box').addClass('disabled');
        },

        /**
         * Draws the html for the gameboard
         */
        drawBoard: function() {
            var html = '';

            for (var ir = 0; ir < this.rows; ir += 1) {
                html += '<div class="row">';

                for (var ic = 0; ic < this.cols; ic += 1) {
                    html += '<div class="box"></div>';
                }

                html += '</div>';
            }

            this.$el.html(html);
            this.$el.removeClass('solved');
            this.$el.off().on('click', '.box', $.proxy(this.onBoxClick) );
        },

        /**
         * Triggered when a box is clicked
         */
        onBoxClick: function(e) {
            var column = $(this).index(),
                row = $(this).closest('.row').index(),
                moves,
                progress;

            e.preventDefault();

            game.toggleBox(row, column);
        },

        /**
         * Toggles a box on or off, as well as the 4 boxes immediately around it
         */
        toggleBox: function(row, col) {
            var above = row - 1,
                below = row + 1,
                left  = col - 1,
                right = col + 1;

            if (this.board[row][col] === undefined) {
                return;
            }

            // Update clicked cell
            this.board[row][col] = !this.board[row][col];
          
            // Update left cell
            if (left >= 0) {
                this.board[row][left] = !this.board[row][left];
            }

            // Update right cell
            if (right < this.cols) {
                this.board[row][right] = !this.board[row][right];
            }

            // Update above cell
            if (above >= 0) {
                this.board[above][col] = !this.board[above][col];
            }

            // Update below cell
            if (below < this.rows) {
                this.board[below][col] = !this.board[below][col];
            }

            this.moves += 1;
            this.trigger('move', this.moves);

            this.updateGameBoard();
        },

        /**
         * Updates the gameboard, applies the active class to any boxes that are currently active
         */
        updateGameBoard: function() {
            var checkedCount = 0, // count of squares that are cecked
                totalSquares = this.rows * this.cols;

            _.each(this.board, function(row, rowIndex) {
                _.each(row, function(col, colIndex) {
                    var selector = ['.row:eq(', rowIndex, ') .box:eq(', colIndex, ')'].join(''),
                        $cell = this.$el.find(selector);

                    $cell.toggleClass('active', col);

                    // If this col is checked, increment the checkedCount
                    checkedCount += col ? 1 : 0;
                }, this);
            }, this);      

            this.trigger('progress', checkedCount / totalSquares);

            if (checkedCount === totalSquares) {
                this.trigger('solved', this.moves);
                this.$el.addClass('solved');
            }
        },

        /**
         * Boards must be rectangular -- the number of columns in the first row must be the same
         * as the number of columns in all othe rows. Aside from that, patterns can only contain 1's
         * 0's, and commas.
         */
        verifyBoardPattern: function(boardPattern) {
            var rowLength = boardPattern.split(',')[0].length,
                validPattern = new RegExp("([10]{" + rowLength + "},?){" + rowLength + "}", "g");

            return !!boardPattern.match(validPattern);
        },

        getPercentSolved: function() {
            var count = this.$el.find('.active').length,
                percent = count / (this.rows * this.cols);

            return percent;
        },

        buildBoardFromPattern: function(pattern) {
            var board = [];

            _.each(pattern.split(','), function(rowPattern) {
                var row = [];

                _.each(rowPattern.split(''), function(cell) {
                    row.push(cell === '1');
                });

                board.push(row);
            });

            return board;
        },

        destroy: function() {
            this.$el.off();
            this.$el.html('');
        },
    }); // end of Game

    var boards = [
        // 3x3
        '111,000,111',
        '101,010,101',
        '000,010,000',
        '010,111,000',

        // 3x5
        '101,111,000,111,101',

        // 4x4
        '1111,1001,1001,1111',
        '1001,0110,0110,1001',
        '0100,0100,0010,0010',

        // 4x6
        '1001,0001,1000,1010,0101,0011',
 
        // 5x5
        '11111,10001,10001,10001,11111',
        '10001,00000,00000,00000,10001',
        '01000,11000,00000,00011,00010',
        '01010,10001,00000,10001,01010',
        '00010,01111,00101,01000,00000',
        '10101,00000,10101,00000,10101',
        '01110,10001,01110,10001,01110',
        '10001,01010,00000,01010,10001',
      
        // 5x6
        '01110,10101,10101,01110,01110,01010',
    ];
  

    var randomBoard = Math.floor(Math.random() * boards.length),
        game = new Game({
            el: $('.container'),
            board: boards[ randomBoard ]
        }),
        progress = Math.floor(game.getPercentSolved() * 100);

    $('.progress-bar .progress').css('min-width', progress + '%');
    $('.progress-label').text(progress + '% solved');



    game.on('progress', function(percent) {
        var progress = Math.floor(percent * 100);

        $('.progress-bar .progress').css('min-width', progress + '%');
        $('.progress-label').text(progress + '% solved');
    });

    game.on('move', function(moveCount) {
        $('.move-counter').text(moveCount + ' moves');
    });

    game.on('solved', function(moveCount) {
        game.deactivate();
    });
  
    $('.help').on('click', function(e) {
      e.preventDefault();
      
      $('.instructions').fadeToggle('fast');
    });
  
    // When user clicks to start a new game
    $('.new-game').on('click', function(e) {
        e.preventDefault();

        var randomBoard = Math.floor(Math.random() * boards.length),
            progress;

        game.setBoard(boards[randomBoard]);

        progress = Math.floor(game.getPercentSolved() * 100);

        $('.progress-bar .progress').css('min-width', progress + '%');
        $('.progress-label').text(progress + '% solved');
      
        $('.move-counter').text('0 moves');
    });
})();