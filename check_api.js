fetch('http://localhost:5002/api/projects')
  .then(res => res.json())
  .then(data => {
      console.log(JSON.stringify(data, null, 2));
  })
  .catch(console.error);
