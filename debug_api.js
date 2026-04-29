fetch('http://localhost:5002/api/pcbs')
  .then(res => res.json())
  .then(data => {
    const maplePcbs = data.filter(p => p.project === 'Maple');
    console.log("Maple PCBs Count:", maplePcbs.length);
    console.log("Maple PCBs:", maplePcbs.map(p => p.board_number).join(', '));
  })
  .catch(err => console.error(err));
