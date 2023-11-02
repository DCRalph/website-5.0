const setPoint = document.querySelector('#setPoint')

const kp = document.querySelector('#kp')
const kpUp = document.querySelector('#kpUp')
const kpDown = document.querySelector('#kpDown')

const ki = document.querySelector('#ki')
const kiUp = document.querySelector('#kiUp')
const kiDown = document.querySelector('#kiDown')

const kd = document.querySelector('#kd')
const kdUp = document.querySelector('#kdUp')
const kdDown = document.querySelector('#kdDown')

const reset = document.querySelector('#resetPid')
const autoChange = document.querySelector('#autoChange')

let oldKp = localStorage.getItem('kp') || 0.1
let oldKi = localStorage.getItem('ki') || 0.01
let oldKd = localStorage.getItem('kd') || 0.01

let data = []

let ammountToDisplay = 20
let time = 50

let autoChangeSetPoint = false

class PID {
  constructor(kp, ki, kd) {
    this.kp = kp
    this.ki = ki
    this.kd = kd
    this.lastError = 0
    this.integral = 0
    this.derivative = 0
    this.dt = time
  }

  update(setPoint, currentValue) {
    let error = setPoint - currentValue
    this.integral += error * this.dt
    this.derivative = (error - this.lastError) / this.dt
    this.lastError = error

    return this.kp * error + this.ki * this.integral + this.kd * this.derivative
  }

  reset() {
    this.lastError = 0
    this.integral = 0
    this.derivative = 0
  }

  setKp(kp) {
    this.kp = kp
  }

  setKi(ki) {
    this.ki = ki
  }

  setKd(kd) {
    this.kd = kd
  }
}

kp.value = Number(oldKp).toFixed(2)
ki.value = Number(oldKi).toFixed(2)
kd.value = Number(oldKd).toFixed(2)

const pid = new PID(Number(oldKp), Number(oldKi), Number(oldKd))

let shift = false

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    shift = true
    console.log('shift')
  }
})

document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shift = false
    console.log('shift')
  }
})

const autoChangeSetPointFunc = (state = null) => {
  if (state === null) {
    autoChangeSetPoint = !autoChangeSetPoint
  } else {
    autoChangeSetPoint = state
  }

  if (autoChangeSetPoint) {
    autoChange.innerHTML = 'Auto Change: ON'

    //bg-orange-600
    //shadow-orange-600/50
    //hover:bg-orange-700
    //ring-orange-500

    // bg-gray-600
    // shadow-gray-600/50
    // hover:bg-gray-700
    // ring-gray-500

    autoChange.classList.replace('bg-gray-600', 'bg-orange-600')
    autoChange.classList.replace('shadow-gray-600/50', 'shadow-orange-600/50')
    autoChange.classList.replace('hover:bg-gray-700', 'hover:bg-orange-700')
    autoChange.classList.replace('ring-gray-500', 'ring-orange-500')
  } else {
    autoChange.innerHTML = 'Auto Change: OFF'

    autoChange.classList.replace('bg-orange-600', 'bg-gray-600')
    autoChange.classList.replace('shadow-orange-600/50', 'shadow-gray-600/50')
    autoChange.classList.replace('hover:bg-orange-700', 'hover:bg-gray-700')
    autoChange.classList.replace('ring-orange-500', 'ring-gray-500')
  }
}

autoChange.addEventListener('click', () => {
  autoChangeSetPointFunc()
})

const incrementAmmount = () => {
  // get shift key pressed
  if (shift) return 0.1
  else return 0.01
}

kpUp.addEventListener('click', () => {
  kp.value = Number(kp.value) + incrementAmmount()
  kp.value = Number(kp.value).toFixed(2)
  localStorage.setItem('kp', kp.value)
  pid.setKp(Number(kp.value))
})

kpDown.addEventListener('click', () => {
  kp.value = Number(kp.value) - incrementAmmount()
  kp.value = Number(kp.value).toFixed(2)
  localStorage.setItem('kp', kp.value)
  pid.setKp(Number(kp.value))
})

kiUp.addEventListener('click', () => {
  ki.value = Number(ki.value) + incrementAmmount()
  ki.value = Number(ki.value).toFixed(2)
  localStorage.setItem('ki', ki.value)
  pid.setKi(Number(ki.value))
})

kiDown.addEventListener('click', () => {
  ki.value = Number(ki.value) - incrementAmmount()
  ki.value = Number(ki.value).toFixed(2)
  localStorage.setItem('ki', ki.value)
  pid.setKi(Number(ki.value))
})

kdUp.addEventListener('click', () => {
  kd.value = Number(kd.value) + incrementAmmount()
  kd.value = Number(kd.value).toFixed(2)
  localStorage.setItem('kd', kd.value)
  pid.setKd(Number(kd.value))
})

kdDown.addEventListener('click', () => {
  kd.value = Number(kd.value) - incrementAmmount()
  kd.value = Number(kd.value).toFixed(2)
  localStorage.setItem('kd', kd.value)
  pid.setKd(Number(kd.value))
})

kp.addEventListener('change', () => {
  kp.value = Number(kp.value).toFixed(2)
  localStorage.setItem('kp', kp.value)
  pid.setKp(Number(kp.value))
})

ki.addEventListener('change', () => {
  ki.value = Number(ki.value).toFixed(2)
  localStorage.setItem('ki', ki.value)
  pid.setKi(Number(ki.value))
})

kd.addEventListener('change', () => {
  kd.value = Number(kd.value).toFixed(2)
  localStorage.setItem('kd', kd.value)
  pid.setKd(Number(kd.value))
})

reset.addEventListener('click', () => {
  pid.reset()

  kp.value = 0.01
  ki.value = 0.01
  kd.value = 0.01

  setPoint.value = 25

  localStorage.setItem('kp', kp.value)
  localStorage.setItem('ki', ki.value)
  localStorage.setItem('kd', kd.value)

  pid.setKp(Number(kp.value))
  pid.setKi(Number(ki.value))
  pid.setKd(Number(kd.value))

  data = []
  updateChart()

  autoChangeSetPointFunc(false)
})

autoChangeSetPointFunc(false)

const myChart = new Chart('myChart', {
  type: 'line',
  data: {},
  options: {
    maintainAspectRatio: false,
    scales: {
      y: {
        suggestedMin: 0,
        suggestedMax: 50,
      },
    },
  },
})

setPoint.attributes.max.value = myChart.options.scales.y.suggestedMax
setPoint.attributes.min.value = myChart.options.scales.y.suggestedMin
setPoint.value = myChart.options.scales.y.suggestedMax / 2

myChart.options.animation = false // disables all animations

const updateChart = () => {
  let lables = [...Array(data.length).keys()].slice(-ammountToDisplay)
  let trimedData = data.slice(-ammountToDisplay)

  let outputs = trimedData.map((item) => item.output)
  let setPoints = trimedData.map((item) => item.setPoint)

  // console.log(trimedData, lables)

  myChart.data = {
    labels: lables,
    datasets: [
      {
        label: 'Pid Output',
        data: outputs,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: incrementAmmount(),
      },
      {
        label: 'Setpoint',
        data: setPoints,
        fill: false,
        borderColor: 'rgb(255, 99, 132)',
        tension: 0,
      },
    ],
  }

  // myChart.options.scales.y.suggestedMax = Number(setPoint.value) + 10
  // myChart.options.scales.y.suggestedMin = Number(setPoint.value) - 10

  myChart.update()
}

const updateData = () => {
  data.push({
    output: pid.update(setPoint.value, data[data.length - 1]?.output || 0),
    setPoint: setPoint.value,
  })

  updateChart()
}

let timer = setInterval(updateData, time)

setInterval(() => {
  if (!autoChangeSetPoint) return
  if (setPoint.value !== '10') {
    setPoint.value = '10'
  } else {
    setPoint.value = '40'
  }
}, 3000)
