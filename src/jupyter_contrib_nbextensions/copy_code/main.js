define([
    'base/js/namespace',
    'base/js/events'
    ], function(Jupyter, events) {

        var cfg = {
            'window_display': false,
            'cols': {
                'lenName': 16,
                'lenType': 16,
                'lenVar': 40
            },
            'kernels_config' : {
                'python': {
                    library: 'script.py',
                    delete_cmd_prefix: 'del ',
                    delete_cmd_postfix: '',
                    varRefreshCmd: 'print(var_dic_list())',
                },
                'celldep':{
                    library: 'ast_parser_celldep.py',
                    hello:'main()'
                },
                'parallel':{
                    library: 'parallelCellsPlug.py',
                    parallelize:'main()'
                }
            },
            'types_to_exclude': ['module', 'function', 'builtin_function_or_method', 'instance', '_Feature']
        }

        var colors = ['5px solid #00ff00','5px solid #00ffff','5px solid #ff5733','5px solid #ff33ff','5px solid #fffc33']


        function read_code_init(lib) {
            var libName = Jupyter.notebook.base_url + "nbextensions/copy_code/" + lib;
            $.get(libName).done(function(data) {
                code_init = data;
              Jupyter.notebook.kernel.execute(code_init, { iopub: { output: code_exec_callback } }, { silent: false });
              console.log('loaded library');
            }).fail(function() {
                console.log('failed to load ' + lib + ' library')
            });
        }

        /**
         * Function to get Cell Contents
         * String separated by buffer value
         */
         var getCellContents = function(cellNum){
            let cellString = ""
            let buffer = "/**/"
            CellList = Jupyter.notebook.get_cells()
            CellList.forEach(element=> {
                if(element.cell_type == "code"){
                    cellString = cellString.concat(element.code_mirror.getValue(),buffer);
                }
            })
            cellString = cellString.concat(cellNum.toString())
            console.log(cellString);
            return cellString;
        }

        /**
         * CopyCode Function loops through each cell and extracts the information within
         * Stores each cell metadata in a JSON object
         */
        var copyCode = function(){
            CellList = Jupyter.notebook.get_cells()
            CellList.forEach(element => {
                if(element.cell_type == "code"){
                    var cell = new Object();
                    cell.cell_id = element.cell_id;
                    cell.cell_content = element.code_mirror.getValue();
                    // TODO: Fix this line by putting in a null guard
                    cell.cell_output = "element.output_area.outputs[0].text";
                    cell.input_prompt_number = element.input_prompt_number;
                    console.log(element.metadata.HorizontalStatus)
                    var cellJson = JSON.stringify(cell);
                    console.log(cellJson);
                }
            });
        };

        function code_exec_callback(msg) {
            if (msg.msg_type == 'stream') {
                console.log(msg.content['text'])
            }
            else if (msg.msg_type == 'execute_result') {
                result = msg.content['data']['text/plain']
                console.log(result)
                outlineBorderHandler(result.slice(1,-1));
            }
            else if (msg.msg_type == 'error') {
                console.log(msg.content['ename']+ ': ' + msg.content['evalue'])
            };
        }

        function code_parallel_callback(msg) {
            console.log('Parallelization')
            if (msg.msg_type == 'stream') {
                console.log(msg.content['text'])
            }
            else if (msg.msg_type == 'execute_result') {
                result = msg.content['data']['text/plain']
                console.log(result)
                parallelHandler(result.slice(1,-1));
            }
            else if (msg.msg_type == 'error') {
                console.log(msg.content['ename']+ ': ' + msg.content['evalue'])
            };
        }

        var outlineBorderHandler = function(text){
            const executionSubLists = text.split('|');
            const selectedCell = parseInt(executionSubLists[0])+1
            console.log(executionSubLists)
            for(let i = 1; i < executionSubLists.length-1; i++){
                let cells = executionSubLists[i].split('-');
                if(executionSubLists.length == 3){
                    let newOrder = Array.from({length: Jupyter.notebook.get_cells().length}, (v, k) => k+1);
                    let arrIndex = 0;
                    for(let thisIndex = 0; thisIndex < newOrder.length;  thisIndex++){
                        if(cells.indexOf(newOrder[thisIndex].toString()) != -1){
                            console.log("reached")
                            newOrder[thisIndex] = parseInt(cells[arrIndex]);
                            arrIndex++;
                        }
                    }
                    reorderCells(newOrder);
                }
                for(let j = 0; j < cells.length-1; j++){
                    outlineBorder(parseInt(cells[j]),colors[i-1])
                }
            }
            outlineBorder(selectedCell,"5px solid #cfcfcf");
        }

        var parallelHandler = function(text){
            const parallelPairs = text.split('|');
            for(let i = 0; i < parallelPairs.length; i++){
                let cells = parallelPairs[i].split('-')
                console.log(cells)
                let isOrderConsecutive = true
                for(let j = 0; j < cells.length-1; j++){
                    if(parseInt(cells[j+1])-parseInt(cells[j])!=1){
                        isOrderConsecutive = false;
                    }
                }
                console.log(isOrderConsecutive)
                if(isOrderConsecutive){
                    //make parallel
                    let cellIndex = parseInt(cells[0])-1
                    console.log(parseInt(cellIndex))
                    let selected_cell = Jupyter.notebook.get_cell(cellIndex)
                    $.extend(true, selected_cell.metadata, {
                        HorizontalStatus: {
                            numCells:cells.length-1
                        }
                    });
                }
            }
            reorganize_cells();
        }

        var executeCellDepScript = function() {
            var cellIndex = 0;
            var cellList = Jupyter.notebook.get_cells();
            for (let index = 0; index < cellList.length; index++){
                if(cellList[index].selected==true){
                    cellIndex = index
                }
            }
            var kernel_config = cfg.kernels_config['celldep'];
            kernel_config.hello = "main('''".concat(getCellContents(cellIndex),"''')")
            requirejs(['nbextensions/varInspector/jquery.tablesorter.min'],    
            function() {
                    Jupyter.notebook.kernel.execute(
                        kernel_config.hello, { iopub: { output: code_exec_callback } }, { silent: false }
                    );
                });
        }

        var executeParallelScript = function(){
            var kernel_config = cfg.kernels_config['parallel'];
            kernel_config.parallelize = "main('''".concat(getCellContents(-1),"''')")
            requirejs(['nbextensions/varInspector/jquery.tablesorter.min'],    
            function() {
                    Jupyter.notebook.kernel.execute(
                        kernel_config.parallelize, { iopub: { output: code_parallel_callback } }, { silent: false }
                    );
                });
        }


        var varRefresh = function() {
            var kernelLanguage = Jupyter.notebook.metadata.kernelspec.language.toLowerCase()
            var kernel_config = cfg.kernels_config[kernelLanguage];
            requirejs(['nbextensions/varInspector/jquery.tablesorter.min'],
                function() {
                    Jupyter.notebook.kernel.execute(
                        kernel_config.varRefreshCmd, { iopub: { output: code_exec_callback } }, { silent: false }
                    );
                });
        };

        var outlineBorder = function(cell,color){
            var selected_cell_element = $('.cell')[cell-1]
            selected_cell_element.children[0].children[1].children[1].style.border=color
        }

        var resetBorders = function(){
            var selected_cell_element = $('.cell')
            for(let cell = 0; cell < selected_cell_element.length; cell++){
                selected_cell_element[cell].children[0].children[1].children[1].style.border="1px solid #cfcfcf"
            }
        }

        /**
         *  Function that will return a cell whose text matches
         *  cellText
         */
        function getCellFromText(cellText){
            var returnCell = undefined
            Jupyter.notebook.get_cells().forEach(element => {
                currentCellText = element.code_mirror.getValue();
                if(currentCellText.localeCompare(cellText)==0){
                    returnCell = element;
                }
            });
            return returnCell
        }

        /**
         * Function that inserts a cell horizontally
         * Saves values in cell metadata which is used to restore horizontal order
         * 
         */
        var insert_cell_in_row = function () {
            varRefresh();  
            var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
            var selected_cell_element = $('.cell')
                .filter(' .selected');
            if (selected_cell_element.parents('.hs')
                .length === 0) {
                Jupyter.notebook.insert_cell_above('code');
                var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                var selected_cell = Jupyter.notebook.get_selected_cell()
                $.extend(true, selected_cell.metadata, {
                    HorizontalStatus: {
                        numCells:1
                    }
                });
                selected_cell_element.wrap('<div class="hs"> </div>');
                var grid = selected_cell_element.parent();
                grid.css({
                    'display': 'grid'
                    , 'grid-gap': '10px'
                    , 'grid-template-columns': 'repeat(6, calc(50% - 40px))'
                    , 'grid-template-rows': 'minmax(150px, 1fr)'
                    , 'overflow-x': 'scroll'
                    , 'scroll-snap-type': 'x proximity'
                    , 'padding-bottom': 'calc(.75 * var(--gutter))'
                    , 'margin-bottom': 'calc(-.25 * var(--gutter))'
                });
                grid.append($('.cell')[selected_cell_idx - 1]);
            } else {
                var grid = selected_cell_element.closest('.hs');
                var child = grid.children('.cell').children('.input').children('.inner_cell')[0]
                gridCell = getCellFromText(child.childNodes[1].innerText)
                gridCell.metadata.HorizontalStatus.numCells += 1
                var added_cell = Jupyter.notebook.insert_cell_above('code');
                var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                grid.append($('.cell')[selected_cell_idx - 1]);
            } 
        };

        /**
         * Function which reorganizes cells back into their horizontal formation
         * 
         * 
         */
         var reorganize_cells = function(){
            CellList = Jupyter.notebook.get_cells()
            for(i = 0; i < CellList.length; i++){
                element = CellList[i]
                if(element.metadata.HorizontalStatus){
                    var cellText = CellList[i+1].code_mirror.getValue()
                    console.log(cellText)
                    varRefresh();  
                    var selected_cell_idx = i;
                    var selected_cell_element = Jupyter.notebook.get_cell(i).element;
                    console.log(selected_cell_idx,selected_cell_element);
                    if (selected_cell_element.parents('.hs')
                        .length === 0) {
                        Jupyter.notebook.insert_cell_above('code').set_text(cellText);
                        Jupyter.notebook.delete_cell(i+2)
                        var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                        var selected_cell = Jupyter.notebook.get_selected_cell()
                        selected_cell_element.wrap('<div class="hs"> </div>');
                        var grid = selected_cell_element.parent();
                        grid.css({
                            'display': 'grid'
                            , 'grid-gap': '10px'
                            , 'grid-template-columns': 'repeat(6, calc(50% - 40px))'
                            , 'grid-template-rows': 'minmax(150px, 1fr)'
                            , 'overflow-x': 'scroll'
                            , 'scroll-snap-type': 'x proximity'
                            , 'padding-bottom': 'calc(.75 * var(--gutter))'
                            , 'margin-bottom': 'calc(-.25 * var(--gutter))'
                        });
                        grid.append($('.cell')[selected_cell_idx - 1]);
                    }
                    for(j = 2; j <= element.metadata.HorizontalStatus.numCells; j++){
                        cellText = CellList[i+j].code_mirror.getValue()
                        var grid = selected_cell_element.closest('.hs');
                        var child = grid.children('.cell').children('.input').children('.inner_cell')[0]
                        var added_cell = Jupyter.notebook.insert_cell_above('code').set_text(cellText);
                        Jupyter.notebook.delete_cell(i+j+1)
                        var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                        grid.append($('.cell')[selected_cell_idx - 1]);
                    }
                }
            }
        }
        

        /**
         * Function which reorganizes cells back into their horizontal formation
         * 
         * 
         */
        var reorganize_cells_old = function(){
            CellList = Jupyter.notebook.get_cells()
            for(i = 0; i < CellList.length; i++){
                element = CellList[i]
                if(element.metadata.HorizontalStatus){
                    var cellText = CellList[i+1].code_mirror.getValue()
                    varRefresh();  
                    var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                    var selected_cell_element = $('.cell')
                        .filter(' .selected');
                    if (selected_cell_element.parents('.hs')
                        .length === 0) {
                        Jupyter.notebook.insert_cell_above('code').set_text(cellText);
                        Jupyter.notebook.delete_cell(i+3)
                        var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                        var selected_cell = Jupyter.notebook.get_selected_cell()
                        selected_cell_element.wrap('<div class="hs"> </div>');
                        var grid = selected_cell_element.parent();
                        grid.css({
                            'display': 'grid'
                            , 'grid-gap': '10px'
                            , 'grid-template-columns': 'repeat(6, calc(50% - 40px))'
                            , 'grid-template-rows': 'minmax(150px, 1fr)'
                            , 'overflow-x': 'scroll'
                            , 'scroll-snap-type': 'x proximity'
                            , 'padding-bottom': 'calc(.75 * var(--gutter))'
                            , 'margin-bottom': 'calc(-.25 * var(--gutter))'
                        });
                        grid.append($('.cell')[selected_cell_idx - 1]);
                    }
                    for(j = 2; j <= element.metadata.HorizontalStatus.numCells; j++){
                        cellText = CellList[i+j].code_mirror.getValue()
                        var grid = selected_cell_element.closest('.hs');
                        var child = grid.children('.cell').children('.input').children('.inner_cell')[0]
                        var added_cell = Jupyter.notebook.insert_cell_above('code').set_text(cellText);
                        Jupyter.notebook.delete_cell(i+j+2)
                        var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                        grid.append($('.cell')[selected_cell_idx - 1]);
                    }
                }
            }
/*             CellList.forEach(element => {
                if(element.metadata.HorizontalStatus){
                    cellText = element.children[0].code_mirror.getValue()
                    varRefresh();  
                    var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                    var selected_cell_element = $('.cell')
                        .filter(' .selected');
                    if (selected_cell_element.parents('.hs')
                        .length === 0) {
                        Jupyter.notebook.insert_cell_above('code').set_text(cellText);
                        var selected_cell_idx = Jupyter.notebook.get_selected_cells_indices()[0];
                        var selected_cell = Jupyter.notebook.get_selected_cell()
                        selected_cell_element.wrap('<div class="hs"> </div>');
                        var grid = selected_cell_element.parent();
                        grid.css({
                            'display': 'grid'
                            , 'grid-gap': '10px'
                            , 'grid-template-columns': 'repeat(6, calc(50% - 40px))'
                            , 'grid-template-rows': 'minmax(150px, 1fr)'
                            , 'overflow-x': 'scroll'
                            , 'scroll-snap-type': 'x proximity'
                            , 'padding-bottom': 'calc(.75 * var(--gutter))'
                            , 'margin-bottom': 'calc(-.25 * var(--gutter))'
                        });
                        grid.append($('.cell')[selected_cell_idx - 1]);
                    }
                }
            }); */
        };

/*         var reorderCells = function(cellOrder){
            CellList = Jupyter.notebook.get_cells()
            CellList.forEach(element => {
                if(cellOrder == element.cellNumber){
                    continue;
                }
            });
        } */


        // /**
        //  * Function to get cell execution order
        //  * First version that just records prompt numbers
        //  */
        // var get_cell_execution = function(){
        //     CellList = Jupyter.notebook.get_cells()
        //     const cellArr = new Array();
        //     let maxInputPromptNumber = 0;
        //     CellList.forEach(element => {
        //         if(element.cell_type == "code"){
        //             if(element.input_prompt_number && element.input_prompt_number > maxInputPromptNumber){
        //                 maxInputPromptNumber = element.input_prompt_number;
        //             }
        //             cellArr.push(element.input_prompt_number);
        //         }
        //     });
        //     for(let i=1; i <= maxInputPromptNumber; i++){
        //         console.log(cellArr.indexOf(i));
        //     }
        //     console.log(cellArr);
        // }

        var get_cell_dependencies = function(){
            let cellData = [];
            CellList = Jupyter.notebook.get_cells()
            CellList.forEach(element => {
                if(element.cell_type == "code"){
                    var cell = new Object();
                    cell.cell_id = element.cell_id;
                    cell.cell_content = element.code_mirror.getValue();
                    // TODO: Fix this line by putting in a null guard
                    cell.cell_output = element.output_area? null: element.output_area.outputs[0].text;
                    cellData.push([cell.cell_content,cell.cell_output])
                }
            });
            console.log(cellData)                            
        }

        /**
         * Function to get cell execution order
         * Second version that just records prompt numbers
         */
         var get_cell_execution = function(){
            get_cell_dependencies();
            const execSync = require('child_process').execSync;
            // import { execSync } from 'child_process';  // replace ^ if using ES modules
            const output = execSync('ls', { encoding: 'utf-8' });  // the default is 'buffer'
            console.log('Output was:', output);
        }

        /**
         * Button Function Handlers
         */

        var organizeCells = function(){
            CellList = Jupyter.notebook.get_cells()
            CellList.forEach(element => {
                if(element.cell_type == "code"){
                    var cell = new Object();
                    cell.cell_id = element.cell_id;
                    cell.cell_content = element.code_mirror.getValue();
                    cell.cell_output = "element.output_area.outputs[0].text";
                    cell.input_prompt_number = element.input_prompt_number;
                    var cellJson = JSON.stringify(cell);
                    console.log(cellJson);
                }
            });
        };

        var reorderCells = function(orderArray){
            console.log("Reorder started");
            for(let i = 0; i < orderArray.length; i++){
                for(let j = 0; j < orderArray[i]-i-1; j++){
                    Jupyter.notebook.move_cell_up(orderArray[i]-j-1)
                }
            }
        }

        var reorderCellsbutton = function () {
            Jupyter.toolbar.add_buttons_group([
                Jupyter.keyboard_manager.actions.register({
                    'help': 'Parallelize Cells'
                    , 'icon': 'fa-sort'
                    , 'handler': executeParallelScript
                }, 'reorder-cells', 'Task Context')
            ])
        };

        var reorganizeCellsButton = function(){
            Jupyter.toolbar.add_buttons_group([
                Jupyter.keyboard_manager.actions.register({
                    'help': 'Reorganize Cells'
                    , 'icon': 'fa-recycle'
                    , 'handler': reorganize_cells
                }, 'reorganize-cells', 'Task Context')
            ])
        };

        var addCellbutton = function () {
            Jupyter.toolbar.add_buttons_group([
                Jupyter.keyboard_manager.actions.register({
                    'help': 'Add cell to selected row'
                    , 'icon': 'fa-sign-in'
                    , 'handler': insert_cell_in_row
                }, 'add-cell-horizontally', 'Task Context')
            ])
        };

        var defaultCellButton = function () {
            Jupyter.toolbar.add_buttons_group([
                Jupyter.keyboard_manager.actions.register ({
                    'help': 'Add default cell',
                    'icon' : 'fa-play-circle',
                    'handler': executeCellDepScript
                }, 'add-default-cell', 'Default cell')
            ])
        }

        var resetBordersButton = function () {
            Jupyter.toolbar.add_buttons_group([
                Jupyter.keyboard_manager.actions.register({
                    'help': 'Reset Cell Borders'
                    , 'icon': 'fa-eraser'
                    , 'handler': resetBorders
                }, 'reset-borders', 'Task Context')
            ])
        };

    // Run on start
    function load_ipython_extension() {
        read_code_init(cfg.kernels_config['celldep'].library)
        read_code_init(cfg.kernels_config['parallel'].library)
        defaultCellButton();
        addCellbutton();
        reorganizeCellsButton();
        reorderCellsbutton();
        resetBordersButton();
        reorganize_cells();
    }
    return {
        load_ipython_extension: load_ipython_extension
    };
});