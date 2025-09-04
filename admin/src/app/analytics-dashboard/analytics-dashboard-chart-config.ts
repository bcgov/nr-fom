import { ChartType } from 'ng-apexcharts';

// Chart options for: Total comments received by category
// This is initial config, component will change it.
export const commentsByResponseCodeChartConfig = {
  title: {
    text: "Total comments received by category"
  },
  series: [
    {
      name: "Comments by Response Code",
      data: [0, 0, 0]
    }
  ],
  chart: {
    type: 'bar' as ChartType,
    height: 380
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: "55%",
      dataLabels: {
        position: "top" // top, center, bottom
      }
    }
  },
  dataLabels: {
    enabled: true,
    formatter: function(val: number) {
      return val;
    },
    offsetY: -25,
    style: {
      fontSize: "12px",
      colors: ["#304758"]
    }
  },
  xaxis: {
    categories: [
      "Considered",
      "Addressed",
      "Not applicable"
    ],
    title: {
      text: "Comment category",
      style: {
        cssClass: "chart-title-label"
      }
    }
  },
  yaxis: {
    title: {
      text: "Number of comments",
      style: {
        cssClass: "chart-title-label"
      }
    }
  },
  fill: {
    opacity: 1,
    colors: ["#123B64"]
  }
};
