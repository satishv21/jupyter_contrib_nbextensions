import ast, itertools, subprocess
from pprint import pprint

cellDict = {}
def main(cellstring):
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
    for j in range(cellNum-1,0,-1):
        cellDepList = getCellDep(j)
        cellDepLists = []
        for i in range(1,len(cellDepList)+1):
            cellDepCombos = [list(k) for k in list(itertools.combinations(cellDepList,i))]
            [subl.append(j) for subl in cellDepCombos if not subl is None]
            cellDepLists.append([item for item in cellDepCombos])
        cellDepLists = [item for sublist in cellDepLists for item in sublist]
        #print(cellDepLists)
        masterCellDepList.insert(0,validateCellDeps(cellDepLists,j))
    return parallelCellProcessing(masterCellDepList)
    
def parallelCellProcessing(cellDeps):
    #Traverse cell by cell
    #print(cellDeps)
    parallelCells = []
    for cell in range(3,len(cellDeps)):
        currCellDep = cellDeps[cell]
        for i in range(0,len(currCellDep)-1):
            listParallelCandidates = [currCellDep[i]]
            for j in range(i+1,len(currCellDep)):
                if len(currCellDep[i])==len(currCellDep[j]) and len(currCellDep[i]) > 2 and currCellDep[i][0] == currCellDep[j][0] and currCellDep[i][-1] == currCellDep[j][-1]:
                    listParallelCandidates.append(currCellDep[j])
            if len(listParallelCandidates) > 1:
                for k in range(1,len(currCellDep[i])-1):
                    listParallelCells = [item for t in parallelCells for item in t]
                    currParallelCandidates = [item[k] for item in listParallelCandidates]
                    if len(set(currParallelCandidates)) == len(currParallelCandidates) and len(set(currParallelCandidates) - set(listParallelCells))==len(currParallelCandidates):
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
    
def checkCellOutput(depList, cellNum, target):
    text = ""
    for num in depList:
        with open(fileNames[num-1], "r") as source:
            text = text + source.read()
    f = open("cellTest.py","w")
    f.write(text)
    f.close()
    proc = subprocess.Popen(['python','cellTest.py'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    result = proc.communicate()[0].decode('utf-8').strip()
    if result == target:
        print("SUCCESS!")
    

def validateCellDeps(cellDepLists,i):
    removeList = []
    for sublist in cellDepLists:
        targetDepList = cellDict[i]["input"].copy()
        for cell in sublist:
            for output in cellDict[cell]["output"]:
                if output in targetDepList:
                    targetDepList.remove(output)
        if targetDepList:
            removeList.append(sublist)
    for cellDepList in cellDepLists:
        if len(cellDepList) > 1:
            if not validateCellDeps([cellDepList[:-1]],cellDepList[-2]) and cellDepList not in removeList:
                removeList.append(cellDepList)
    for list in removeList:
        cellDepLists.remove(list)
    return cellDepLists

def getCellDep(i):
    depList = []
    potentialCellList = []
    for cell in cellDict[i]["input"]:
        for j in range(1,i):
            if(cell in cellDict[j]["output"] and j not in depList):
                for parentcell in getCellDep(j):
                    if parentcell not in depList:
                        depList.append(parentcell)
                depList.append(j)
    return depList

class Analyzer(ast.NodeVisitor):
    def __init__(self):
        self.stats = {"input": [], "func_call": [], "output": [], "rewrite": [], "order": []}

    def visit_Name(self, node):
        self.stats["order"].append(node.id)
        if isinstance(node.ctx, ast.Load):
            # print(node)
            if (node.id not in self.stats["func_call"]) and (node.id not in self.stats["input"]):
                self.stats["input"].append(node.id)
            
        if isinstance(node.ctx, ast.Store):
            # print(node.id)
            if (node.id in self.stats["output"]):
                if (node.id not in self.stats["rewrite"]):
                    self.stats["rewrite"].append(node.id)
            else:
                self.stats["output"].append(node.id)
        self.generic_visit(node)

    def visit_Call(self, node):
        if (node.func.id in self.stats["input"]):
            self.stats["input"].remove(node.func.id)
        
        self.stats["func_call"].append(node.func.id)
        self.generic_visit(node)

    # def visit_ImportFrom(self, node):
    #     for alias in node.names:
    #         self.stats["output"].append(alias.name)
    #     self.generic_visit(node)

    def report(self):
        return self.stats
