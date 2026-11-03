import Highcharts from 'highcharts';

export const PALETTE = ['#2f6fdb', '#e5408a', '#1d4ba3', '#f8a6cb', '#93b6fb', '#8f174b'];

const font = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

Highcharts.setOptions({
  colors: PALETTE,
  chart: { backgroundColor: 'transparent', style: { fontFamily: font }, spacing: [8, 8, 8, 8] },
  title: { text: undefined },
  credits: { enabled: false },
  legend: { itemStyle: { color: '#3a4663', fontWeight: '600', fontSize: '12px' }, itemHoverStyle: { color: '#2f6fdb' } },
  xAxis: { lineColor: '#dfeaff', tickColor: '#dfeaff', labels: { style: { color: '#5c6884', fontSize: '12px' } } },
  yAxis: { gridLineColor: '#e8eefb', title: { text: undefined }, labels: { style: { color: '#5c6884', fontSize: '12px' } } },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: '#c3d7ff',
    borderRadius: 12,
    shadow: { color: 'rgba(20,48,107,0.18)', offsetY: 6, width: 18 },
    style: { color: '#14213d', fontSize: '12px' },
  },
  plotOptions: { series: { animation: { duration: 900 } } },
  lang: { thousandsSep: ',' },
});

export { Highcharts };
