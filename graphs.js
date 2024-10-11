

// let adjListWeigtend = [[(1,7),(2,1)],[(0,7),(2,1)],[(0,10),(1,1),(3,12)],[(2,12)]]
let adjListUndirected =  [[1,2],[0,2],[0,1,3],[2]]

let adjListDirected =  [[1,2],[],[1,3],[2]]

let edges = 0;
for( let edge of adjListDirected) {
    edges += edge.length
}

console.log("edges: ", edges)



let edges_u = 0;
for( let edge_u of adjListUndirected) {
    edges_u += edge_u.length
}


console.log("edges_u: ", edges_u/2)

let adjMatrix=[
    [0,1,1,0],
    [1,0,1,0],
    [1,1,0,1],
    [0,0,1,0]]

let adjList=[]

for (let i = 0; i< adjMatrix.length; i++) {
    let naighbors = []
    for (let j=0; j< adjMatrix[0].length;j++){
        if(adjMatrix[i][j] == 1) {
            naighbors.push(j)
        }
    }
    console.log('naighbors', naighbors)
adjList.push(naighbors)
}

console.log('adjList', adjList)

// let adjListUndirected =  [[1,2],[0,2],[0,1,3],[2]]

let vipNodes = [1,2]

let neigborNodes = new Set()
for (let i=0; i<vipNodes.length; i++) {
    for(let j=0; j<adjListUndirected[i].length; j++){
        console.log("III", adjListUndirected[vipNodes[i]])
        if(adjListUndirected[vipNodes[i]][j] !== vipNodes[i]) neigborNodes.add(adjListUndirected[vipNodes[i]])
    }
}


console.log('neigborNodes', neigborNodes)