async function checkServer() {
    try {
        const res = await fetch("http://localhost:5173/");
        console.log("Status:", res.status);
        console.log("Headers:", res.headers.get("content-type"));
    } catch(e) {
        console.log("Server not running or error:", e.message);
    }
}
checkServer();
