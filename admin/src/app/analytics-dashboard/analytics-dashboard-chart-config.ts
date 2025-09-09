import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexFill, ApexGrid, ApexPlotOptions, ApexTheme, ApexTitleSubtitle, ApexXAxis, ApexYAxis, ChartType } from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  xaxis: ApexXAxis;
  fill: ApexFill;
  title: ApexTitleSubtitle;
  theme: ApexTheme;
  grid: ApexGrid;
};

const COLOR_LABEL = "#304758";
const COLOR_FILL_1 = "#123B64";
const COLOR_FILL_2 = "#52AE1E";
const COLOR_FILL_3 = "#2576C8";
const COLOR_FILL_4 = "#775DD0";
const COLOR_GRID_ROW_1 = "#f3f3f3";

/* *** Some utility functions to help with chart configuration and display *** */
export const maxAxis = (series) => {
  let maxValue = Math.max(...series);
  let maxAxis = 10;
  switch (true) {
    case (maxValue < 10):
      break;
    case (maxValue < 40):
      maxAxis = 40;
      break;
    case (maxValue < 100):
      maxAxis = 100;
      break;
    case (maxValue < 500):
      maxAxis = 500;
      break;
    default:
      maxAxis = Math.ceil(maxValue / 1000) * 1000;
  }
  return maxAxis;
}

/* *** Below are initial config, component will change it. *** */
// Chart options for: Total comments received by category
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
      columnWidth: "45%",
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
      "Irrelevant",
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
    min: 0
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
    min: 0, // important if max is dynamically set.
  } as ApexXAxis,
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

// Chart options for: FOMs published for public comments in each district
export const fomsCountByDistrictChartOptions = {
  title: {
    text: "FOMs published for public comments in each district"
  },
  series: [
    {
      name: "Number of FOMs submitted",
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
  } as ApexDataLabels,
  xaxis: {
    categories: [
    ],
    title: {
      text: "Number of FOMs submitted",
      style: {
        cssClass: "chart-title-label"
      }
    },
    min: 0, // important if max is dynamically set.
  } as ApexXAxis,
  yaxis: {
    title: {
      text: "District",
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
    colors: [COLOR_FILL_3]
  },
  grid: {
    row: {
      colors: [COLOR_GRID_ROW_1, "transparent"],
      opacity: 0.5
    },
  },
};

// Chart options for: FOM submissions by forest client
export const fomsCountByForestClientChartOptions = {
  title: {
    text: "FOM submissions by forest client"
  },
  series: [
    {
      name: "Number of FOMs submitted",
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
  } as ApexDataLabels,
  xaxis: {
    categories: [],
    title: {
      text: "Number of FOMs submitted",
      style: {
        cssClass: "chart-title-label"
      }
    },
  } as ApexXAxis,
  yaxis: {
    title: {
      text: "Forest Client",
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
    colors: [COLOR_FILL_4]
  },
  grid: {
    row: {
      colors: [COLOR_GRID_ROW_1, "transparent"],
      opacity: 0.5
    },
  },
};