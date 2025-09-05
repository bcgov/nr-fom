import { ApexChart, ApexTheme, ApexYAxis, ChartType } from 'ng-apexcharts';

const COLOR_LABEL = "#304758";
const COLOR_FILL_1 = "#123B64";
const COLOR_FILL_2 = "#52AE1E";
const COLOR_GRID_ROW_1 = "#f3f3f3";
// Chart options for: Total comments received by category
// This is initial config, component will change it.
export const commentsByResponseCodeChartOptions = {
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
  theme: {
    mode: 'light',
  } as ApexTheme,
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
      colors: [COLOR_LABEL]
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
    },
  },
  fill: {
    opacity: 1,
    colors: [COLOR_FILL_1]
  }
};

export const topCommentedProjectsChartOptions = {
  title: {
    text: "Total 15 FOMs with most public comments"
  },
  series: [
    {
      name: "Top 15 Commented Projects",
      data: []
    }
  ],
  chart: {
    type: 'bar' as ChartType,
  } as ApexChart,
  theme: {
    mode: 'light',
  } as ApexTheme,
  plotOptions: {
    bar: {
      horizontal: true,
      barHeight: '24px', // Adjust this value to change the thickness of the bars
      dataLabels: {
        position: 'right', // This positions the label at the end of each bar
      }
    },
  },
  dataLabels: {
    enabled: true,
    position: 'right',
    formatter: function(val: number) {
      return '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' + val;
    },
    style: {
      fontSize: "12px",
      colors: [COLOR_LABEL]
    }
  },
  xaxis: {
    categories: [
    ],
    title: {
      text: "Number of comments",
      style: {
        cssClass: "chart-title-label"
      }
    },
  },
  yaxis: {
    title: {
      text: "FOM Number (District), Forest Client",
      style: {
        cssClass: "chart-title-label"
      }
    },
    labels: {
      show: true,
      align: 'left',
      maxWidth: 400, // This is important when dealing with long labels!!
    }
  } as ApexYAxis,
  fill: {
    opacity: 1,
    colors: [COLOR_FILL_2]
  },
  grid: {
    row: {
      colors: [COLOR_GRID_ROW_1, "transparent"],
      opacity: 0.5
    },
  },
};