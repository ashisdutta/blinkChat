console.log("-----------------------------------------");
console.log("Worker Service Started Successfully");
console.log("Waiting for jobs from Redis...");
console.log("-----------------------------------------");

// Keep the process alive forever
setInterval(() => {
  // Logic to process queue will go here later
}, 1000 * 60);
