import ast, itertools, subprocess
from pprint import pprint

cellDict = {}


def main(cellstring):
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


def formatOutput(cellDependencies, selectedCell):
    formatString = str(selectedCell) + '|'
    for cellDep in cellDependencies:
        for cell in cellDep:
            formatString += str(cell) + '-'
        formatString += '|'
    return formatString


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
# print(main('''a = 3
# b = 4/**/c = a * 2
# d = 6
# print(c*d)/**/meanA = (a + b)/2/**/meanB = (c + d)/2/**/combinedMean = (a + b + c + d)/4/**/2'''))
# print(main('''a = 3
# b = 4/**/c = 5
# d = 6/**/meanA = (a + b)/2/**/meanB = (c + d)/2/**/combinedMean = (a + b + c + d)/4/**/2'''))
# print(main('''import math
# data = [97, 43, 75, 69, 30, 26, 91, 60, 88, 17]/**/dataSum = 0
# for val in data:
#    dataSum += val
# mean = dataSum/len(data)/**/dataDiffs = []
# for val in data:
#    dataDiffs.append(val-mean)/**/stdDev = 0
# for val in dataDiffs:
#    stdDev += val
# stdDev /= len(dataDiffs)
# stdDev = math.sqrt(stdDev)/**/for i in range(len(dataDiffs)):
#    dataDiffs[i] *= dataDiffs[i]/**/print("The Standard Deviation of this Data is: ", stdDev)/**/0'''))
