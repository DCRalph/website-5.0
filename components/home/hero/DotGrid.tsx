import anime from 'animejs'

export const DotGrid = () => {
  const GRID_WIDTH = 25
  const GRID_HEIGHT = 20

  const dots = []

  const handleDotClick = (e: any) => {
    anime({
      targets: '.dot-point',
      scale: [
        { value: 1.35, easing: 'easeOutSine', duration: 250 },
        { value: 1, easing: 'easeInOutQuad', duration: 500 },
      ],
      translateY: [
        { value: -15, easing: 'easeOutSine', duration: 250 },
        { value: 0, easing: 'easeInOutQuad', duration: 500 },
      ],
      opacity: [
        { value: 0.8, easing: 'easeOutSine', duration: 250 },
        { value: 0.4, easing: 'easeInOutQuad', duration: 500 },
      ],
      delay: anime.stagger(100, {
        grid: [GRID_WIDTH, GRID_HEIGHT],
        from: e.target.dataset.index,
      }),
    })
  }

  let index = 0

  for (let i = 0; i < GRID_WIDTH; i++) {
    for (let j = 0; j < GRID_HEIGHT; j++) {
      dots.push(
        <div
          onClick={handleDotClick}
          className={"dotWrapper group"}
          data-index={index}
          key={`${i}-${j}`}>
          <div className={"w-2 h-2 rounded-full bg-gradient-to-b from-background to-text group-hover:from-brand group-hover:to-background group-hover:!opacity-100 opacity-40 dot-point"} data-index={index} />
        </div>
      )
      index++
    }
  }

  return (
    <div
      style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}
      className={"absolute top-3 bottom-3 right-14 grid max-w-[75%] h-20 z-0"}>
      {dots.map((dot) => dot)}
    </div>
  )
}
