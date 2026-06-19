const defaultQuestions = [
    {
        title: "Two Sum",
        description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
        difficulty: "Easy",
        topic: "Arrays",
        sampleInput: "nums = [2,7,11,15], target = 9",
        sampleOutput: "[0,1]",
        constraints: [
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Only one valid answer exists."
        ],
        hints: [
            "A brute force approach would be to use nested loops, which takes O(N^2) time.",
            "Can we use a hash map to store the difference between the target and the current element as we iterate?",
            "With a hash map, we can look up the complement in O(1) time, bringing overall time complexity to O(N)."
        ],
        isCustom: false
    },
    {
        title: "Valid Parentheses",
        description: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
        difficulty: "Easy",
        topic: "Stacks",
        sampleInput: "s = \"()[]{}\"",
        sampleOutput: "true",
        constraints: [
            "1 <= s.length <= 10^4",
            "s consists of parentheses only: '()[]{}'"
        ],
        hints: [
            "A stack is a Last-In-First-Out (LIFO) data structure. We can push open brackets onto it.",
            "When we encounter a closing bracket, we check if the stack is not empty and if the top of the stack matches the closing bracket type.",
            "If it matches, pop it. If not, or if the stack is empty, return false. Finally, check if the stack is empty."
        ],
        isCustom: false
    },
    {
        title: "Reverse Linked List",
        description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
        difficulty: "Easy",
        topic: "Linked Lists",
        sampleInput: "head = [1,2,3,4,5]",
        sampleOutput: "[5,4,3,2,1]",
        constraints: [
            "The number of nodes in the list is the range [0, 5000].",
            "-5000 <= Node.val <= 5000"
        ],
        hints: [
            "We can reverse the list iteratively by keeping track of the current node, the previous node, and the next node.",
            "In each iteration, store the next node, set current.next to previous, and move previous and current pointers forward."
        ],
        isCustom: false
    },
    {
        title: "Implement Queue using Stacks",
        description: "Implement a first in first out (FIFO) queue using only two stacks. The implemented queue should support all the functions of a normal queue (`push`, `peek`, `pop`, and `empty`).",
        difficulty: "Easy",
        topic: "Queues",
        sampleInput: "[\"MyQueue\", \"push\", \"push\", \"peek\", \"pop\", \"empty\"] \n[[], [1], [2], [], [], []]",
        sampleOutput: "[null, null, null, 1, 1, false]",
        constraints: [
            "1 <= x <= 9",
            "At most 100 calls will be made to push, pop, peek, and empty.",
            "All the calls to pop and peek are valid."
        ],
        hints: [
            "We have two stacks, say s1 and s2. s1 can hold input, and s2 can hold output.",
            "When popping or peeking, if s2 is empty, we transfer all elements from s1 to s2. This reverses the order so that the first element in s1 becomes the top of s2."
        ],
        isCustom: false
    },
    {
        title: "Maximum Depth of Binary Tree",
        description: "Given the root of a binary tree, return its maximum depth.\n\nA binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.",
        difficulty: "Easy",
        topic: "Trees",
        sampleInput: "root = [3,9,20,null,null,15,7]",
        sampleOutput: "3",
        constraints: [
            "The number of nodes in the tree is in the range [0, 10^4].",
            "-100 <= Node.val <= 100"
        ],
        hints: [
            "We can solve this recursively. The depth of a node is 1 + the maximum of the depths of its left and right subtrees.",
            "Base case: if the root is null, return 0."
        ],
        isCustom: false
    },
    {
        title: "Fibonacci Number",
        description: "The Fibonacci numbers, commonly denoted `F(n)` form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1. That is:\n\nF(0) = 0, F(1) = 1\nF(n) = F(n - 1) + F(n - 2), for n > 1.\n\nGiven `n`, calculate `F(n)`.",
        difficulty: "Easy",
        topic: "Recursion",
        sampleInput: "n = 4",
        sampleOutput: "3",
        constraints: [
            "0 <= n <= 30"
        ],
        hints: [
            "A simple recursive formula is direct: fib(n) = fib(n-1) + fib(n-2). But it takes O(2^N) time.",
            "We can optimize this using memoization (storing intermediate results) or by computing iteratively using two variables in O(N) time and O(1) space."
        ],
        isCustom: false
    },
    {
        title: "Contains Duplicate",
        description: "Given an integer array `nums`, return `true` if any value appears at least twice in the array, and return `false` if every element is distinct.",
        difficulty: "Easy",
        topic: "Hashing",
        sampleInput: "nums = [1,2,3,1]",
        sampleOutput: "true",
        constraints: [
            "1 <= nums.length <= 10^5",
            "-10^9 <= nums[i] <= 10^9"
        ],
        hints: [
            "We can sort the array and check if any adjacent elements are equal, which takes O(N log N) time.",
            "Alternatively, we can use a Hash Set. As we scan, we insert numbers. If we find a number already in the Set, we return true."
        ],
        isCustom: false
    },
    {
        title: "Binary Search",
        description: "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.",
        difficulty: "Easy",
        topic: "Searching",
        sampleInput: "nums = [-1,0,3,5,9,12], target = 9",
        sampleOutput: "4",
        constraints: [
            "1 <= nums.length <= 10^4",
            "-10^4 < nums[i], target < 10^4",
            "All the integers in nums are unique.",
            "nums is sorted in ascending order."
        ],
        hints: [
            "Initialize two pointers: low = 0 and high = nums.length - 1.",
            "Calculate mid = low + Math.floor((high - low) / 2). Check if nums[mid] is equal to target.",
            "If target is smaller, adjust high pointer. If larger, adjust low pointer."
        ],
        isCustom: false
    },
    {
        title: "Merge Sort Implementation",
        description: "Implement a function `mergeSort(arr)` that sorts an array of integers in ascending order using the Merge Sort algorithm.\n\nMerge Sort is a divide-and-conquer algorithm that recursively splits the array into halves, sorts them, and merges them.",
        difficulty: "Medium",
        topic: "Sorting",
        sampleInput: "arr = [38, 27, 43, 3, 9, 82, 10]",
        sampleOutput: "[3, 9, 10, 27, 38, 43, 82]",
        constraints: [
            "1 <= arr.length <= 5 * 10^4",
            "-10^5 <= arr[i] <= 10^5"
        ],
        hints: [
            "Divide the array into two halves at each step: const mid = Math.floor(arr.length / 2).",
            "Recursively call mergeSort on left and right sub-arrays.",
            "Write a merge helper function that takes two sorted arrays and combines them in sorted order."
        ],
        isCustom: false
    },
    {
        title: "Debounce Function",
        description: "Write a JavaScript function `debounce(fn, delay)` that returns a debounced version of the passed function.\n\nThe debounced function delays the execution of `fn` until after `delay` milliseconds have elapsed since the last time the debounced function was invoked. This is useful for rate-limiting events like typing or resizing.",
        difficulty: "Medium",
        topic: "JavaScript",
        sampleInput: "debounce(handler, 300) invoked rapidly",
        sampleOutput: "handler is called once, 300ms after the last invocation",
        constraints: [
            "delay is in milliseconds",
            "fn must receive arguments and preserve execution context (`this` keyword)"
        ],
        hints: [
            "Use a closure to keep track of a timer variable (e.g., `let timeoutId`).",
            "Each time the returned function is called, clear the existing timeout: `clearTimeout(timeoutId)`.",
            "Start a new timeout that calls `fn.apply(context, args)` after the delay."
        ],
        isCustom: false
    },
    {
        title: "Custom UseEffect Hook",
        description: "In React, `useEffect` handles side-effects. Describe or write a custom React utility/hook `useCustomEffect(effect, deps)` that mimics the dependency tracking of `useEffect` in a functional React component without using the native `useEffect` directly.",
        difficulty: "Hard",
        topic: "React",
        sampleInput: "useCustomEffect(() => { console.log('runs'); }, [dependency])",
        sampleOutput: "runs when dependency changes",
        constraints: [
            "Must track array dependencies and do shallow comparison.",
            "Must support cleanup functions returned by the effect callback."
        ],
        hints: [
            "You need to store the previous dependency array across renders. `useRef` is ideal for storing mutable data that persists.",
            "Compare the current dependencies with the stored previous dependencies.",
            "If they differ (or it is the initial render), invoke the cleanup function of the previous effect (if it exists) and then trigger the new effect callback, storing the returned cleanup."
        ],
        isCustom: false
    },
    {
        title: "Express Request Logger Middleware",
        description: "Write a Node.js Express middleware function `requestLogger(req, res, next)` that logs details about incoming HTTP requests. It should print the HTTP Method, URL, and the duration it took to complete the request (in milliseconds) after the response is sent.",
        difficulty: "Medium",
        topic: "Node.js",
        sampleInput: "GET /api/users",
        sampleOutput: "logs 'GET /api/users - 45ms'",
        constraints: [
            "Must call `next()` to pass execution along the middleware chain.",
            "Must record start time and hook into res 'finish' or 'close' event to calculate elapsed time."
        ],
        hints: [
            "Record `const start = process.hrtime()` or `const start = Date.now()` at the beginning.",
            "Listen to `res.on('finish', ...)` to execute the log after the response has successfully finished transmitting.",
            "Calculate difference and print using console.log."
        ],
        isCustom: false
    },
    {
        title: "Reverse Words in a String",
        description: "Given an input string `s`, reverse the order of the words.\n\nA word is defined as a sequence of non-space characters. The words in `s` will be separated by at least one space.\n\nReturn a string of the words in reverse order concatenated by a single space. Note that `s` may contain leading or trailing spaces or multiple spaces between two words. The returned string should only have a single space separating the words. Do not include any extra spaces.",
        difficulty: "Medium",
        topic: "Strings",
        sampleInput: "s = \"  hello world  \"",
        sampleOutput: "\"world hello\"",
        constraints: [
            "1 <= s.length <= 10^4",
            "s contains English letters (upper-case and lower-case), digits, and spaces ' '.",
            "There is at least one word in s."
        ],
        hints: [
            "First, split the string into words. You can split by spaces and filter out empty strings.",
            "Reverse the array of words.",
            "Join the words together with a single space: `words.join(' ')`."
        ],
        isCustom: false
    },
    {
        title: "Climbing Stairs",
        description: "You are climbing a staircase. It takes `n` steps to reach the top.\n\nEach time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
        difficulty: "Easy",
        topic: "Dynamic Programming",
        sampleInput: "n = 3",
        sampleOutput: "3",
        constraints: [
            "1 <= n <= 45"
        ],
        hints: [
            "To reach the n-th step, you could have come from either the (n-1)-th step or the (n-2)-th step.",
            "Thus, the total number of ways to reach step n is ways(n-1) + ways(n-2). This is equivalent to the Fibonacci sequence.",
            "Solve iteratively to prevent call stack overflow: use a dynamic programming array or simple state variables."
        ],
        isCustom: false
    },
    {
        title: "Shortest Path in Unweighted Graph",
        description: "Given an unweighted, undirected graph represented as an adjacency list, and a starting node `start` and ending node `end`, return the shortest path (as an array of node values) from `start` to `end`. If no path exists, return `null`.",
        difficulty: "Medium",
        topic: "Graphs",
        sampleInput: "graph = {A: ['B', 'C'], B: ['A', 'D'], C: ['A'], D: ['B']}, start = 'A', end = 'D'",
        sampleOutput: "['A', 'B', 'D']",
        constraints: [
            "Number of vertices V <= 10^3, number of edges E <= 5 * 10^3.",
            "The graph is connected or disconnected."
        ],
        hints: [
            "For finding the shortest path in an unweighted graph, Breadth-First Search (BFS) is optimal because it explores level by level.",
            "Keep a queue of paths, or a `visited` set and a `parent` mapping to reconstruct the path after reaching the end."
        ],
        isCustom: false
    }
];

module.exports = { defaultQuestions };
