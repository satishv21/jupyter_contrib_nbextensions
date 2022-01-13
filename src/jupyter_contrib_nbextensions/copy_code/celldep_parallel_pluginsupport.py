import ast, itertools, subprocess
from pprint import pprint

cellDict = {}


def parallel(cellstring):
    cellDict.clear()
    cellNum = 1
    cells = cellstring.split('/**/')
    selectedCell = int(cells[-1])
    for cell in cells[:-1]:
        tree = ast.parse(cell)
        analyzer = Analyzer()
        analyzer.visit(tree)
        cellDict[cellNum] = analyzer.report()
        cellNum += 1;
    masterCellDepList = []
    for j in range(cellNum - 1, 0, -1):
        cellDepList = getCellDep(j)
        cellDepLists = []
        for i in range(1, len(cellDepList) + 1):
            cellDepCombos = [list(k) for k in list(itertools.combinations(cellDepList, i))]
            [subl.append(j) for subl in cellDepCombos if not subl is None]
            cellDepLists.append([item for item in cellDepCombos])
        cellDepLists = [item for sublist in cellDepLists for item in sublist]
        masterCellDepList.insert(0, validateCellDeps(cellDepLists))
    return parallelCellProcessing(masterCellDepList)


def cellDep(cellstring):
    cellDict.clear()
    cellNum = 1
    cells = cellstring.split('/**/')
    print(cells)
    selectedCell = int(cells[-1])
    for cell in cells[:-1]:
        tree = ast.parse(cell)
        analyzer = Analyzer()
        analyzer.visit(tree)
        cellDict[cellNum] = analyzer.report()
        cellNum += 1;
    masterCellDepList = []
    for j in range(cellNum - 1, 0, -1):
        cellDepList = getCellDep(j)
        cellDepLists = []
        for i in range(1, len(cellDepList) + 1):
            cellDepCombos = [list(k) for k in list(itertools.combinations(cellDepList, i))]
            [subl.append(j) for subl in cellDepCombos if not subl is None]
            cellDepLists.append([item for item in cellDepCombos])
        cellDepLists = [item for sublist in cellDepLists for item in sublist]
        # print(cellDepLists)
        masterCellDepList.insert(0, validateCellDeps(cellDepLists))
    pprint(masterCellDepList)
    return formatOutput(masterCellDepList[selectedCell], selectedCell)


def parallelCellProcessing(cellDeps):
    # Traverse cell by cell
    # print(cellDeps)
    parallelCells = []
    for cell in range(3, len(cellDeps)):
        currCellDep = cellDeps[cell]
        for i in range(0, len(currCellDep) - 1):
            listParallelCandidates = [currCellDep[i]]
            for j in range(i + 1, len(currCellDep)):
                if len(currCellDep[i]) == len(currCellDep[j]) and len(currCellDep[i]) > 2 and currCellDep[i][0] == \
                        currCellDep[j][0] and currCellDep[i][-1] == currCellDep[j][-1]:
                    listParallelCandidates.append(currCellDep[j])
            if len(listParallelCandidates) > 1:
                for k in range(1, len(currCellDep[i]) - 1):
                    listParallelCells = [item for t in parallelCells for item in t]
                    currParallelCandidates = [item[k] for item in listParallelCandidates]
                    if len(set(currParallelCandidates)) == len(currParallelCandidates) and len(
                            set(currParallelCandidates) - set(listParallelCells)) == len(currParallelCandidates):
                        parallelCells.append(currParallelCandidates)
    return formatParallelCells(parallelCells)


def formatParallelCells(parallelCells):
    outputString = ''
    for pair in parallelCells:
        for item in pair:
            outputString += str(item) + '-'
        if outputString[-1] == '-':
            outputString = outputString[:-1]
        outputString += '|'
    return outputString[:-1]


def formatOutput(cellDependencies, selectedCell):
    formatString = str(selectedCell) + '|'
    for thisCellDep in cellDependencies:
        for cell in thisCellDep:
            formatString += str(cell) + '-'
        formatString += '|'
    return formatString


def validateCellDeps(cellDepLists):
    removeList = []
    for sublist in cellDepLists:
        outputVariables = []
        for cell in sublist:
            if list(set(cellDict[cell]["input"]) - set(outputVariables)):
                removeList.append(sublist)
            outputVariables.extend(cellDict[cell]["output"])
    cellDepLists = [depList for depList in cellDepLists if depList not in removeList]
    return cellDepLists


def getCellDep(i):
    depList = []
    potentialCellList = []
    for cell in cellDict[i]["input"]:
        for j in range(1, i):
            if cell in cellDict[j]["output"] and j not in depList:
                for parentcell in getCellDep(j):
                    if parentcell not in depList:
                        depList.append(parentcell)
                depList.append(j)
    return depList


def checkCellOutput(depList, cells, cellNum, target):
    text = ""
    for num in depList:
        text = text + cells[num - 1]
    f = open("cellTest.py", "w")
    f.write(text)
    f.close()
    proc = subprocess.Popen(['python', 'cellTest.py'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    result = proc.communicate()[0].decode('utf-8').strip()
    if result == target:
        print("SUCCESS!")


class Analyzer(ast.NodeVisitor):
    def __init__(self):
        self.stats = {"input": [], "func_call": [], "output": [], "rewrite": [], "order": [], "iterables": []}

    #    def visit_For(self,node):
    #        print(node.target.id, node.iter.id)
    #        self.stats["iterables"].append(node.target.id)
    #        self.generic_visit(node)

    def visit_Name(self, node):
        self.stats["order"].append(node.id)
        if isinstance(node.ctx, ast.Load):
            if (node.id not in self.stats["func_call"]) and (node.id not in self.stats["input"]) and (
                    node.id not in self.stats["output"]) and (node.id not in self.stats["iterables"]):
                self.stats["input"].append(node.id)

        if isinstance(node.ctx, ast.Store):
            # print(node.id)
            if node.id in self.stats["output"]:
                if node.id not in self.stats["rewrite"]:
                    self.stats["rewrite"].append(node.id)
            else:
                if node.id not in self.stats["iterables"]:
                    self.stats["output"].append(node.id)
        self.generic_visit(node)

    def visit_Call(self, node):
        for item in node.args:
            if isinstance(item, ast.Name):
                if (item.id not in self.stats["output"]) and (item.id not in self.stats["input"]):
                    self.stats["input"].append(item.id)
        if node.func.id in self.stats["input"]:
            self.stats["input"].remove(node.func.id)

        self.stats["func_call"].append(node.func.id)
        self.generic_visit(node)

    # def visit_ImportFrom(self, node):
    #     for alias in node.names:
    #         self.stats["output"].append(alias.name)
    #     self.generic_visit(node)

    def report(self):
        return self.stats
