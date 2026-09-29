import { use } from 'echarts/core'

import {
  CanvasRenderer
} from 'echarts/renderers'

import {
  BarChart,
  PieChart,
  LineChart
} from 'echarts/charts'

import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  DataZoomComponent,
  GraphicComponent
} from 'echarts/components'

use([
  CanvasRenderer,

  BarChart,
  PieChart,
  LineChart,

  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  DataZoomComponent,
  GraphicComponent
])