import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

class AnalyticsTab extends StatefulWidget {
  const AnalyticsTab({super.key});

  @override
  State<AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<AnalyticsTab> {
  List<dynamic> last1800 = [];
  List<dynamic> allData = [];
  String activeTab = 'volume';

  final Map<String, Map<String, dynamic>> metricConfig = {
    'volume': {
      'field': 'totalVolumeL',
      'label': 'Total Volume (L)',
      'color': Colors.red,
      'unit': 'L',
    },
    'flow': {
      'field': 'flowRateLpm',
      'label': 'Flow Rate (L/min)',
      'color': Colors.blue,
      'unit': 'L/min',
    },
    'valve': {
      'field': 'valve',
      'label': 'Valve State',
      'color': Colors.green,
      'unit': '',
    },
  };

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  Future<void> fetchData() async {
    try {
      final r1 =
          await http.get(Uri.parse('http://localhost:3020/data/last1800'));
      final r2 = await http.get(Uri.parse('http://localhost:3020/data/all'));
      if (r1.statusCode == 200 && r2.statusCode == 200) {
        setState(() {
          last1800 = jsonDecode(r1.body);
          allData = jsonDecode(r2.body);
        });
      }
    } catch (e) {
      print("Error fetching data: $e");
    }
  }

  Widget buildChart(List<dynamic> data) {
    if (data.isEmpty) {
      return const Center(child: Text("No data available"));
    }

    final field = metricConfig[activeTab]!['field'];
    final isValve = activeTab == 'valve';
    final color = metricConfig[activeTab]!['color'];

    final sorted = [...data]..sort((a, b) => DateTime.parse(a['timestamp'])
        .compareTo(DateTime.parse(b['timestamp'])));

    final spots = sorted.map<FlSpot>((item) {
      final time =
          DateTime.parse(item['timestamp']).millisecondsSinceEpoch.toDouble();
      final val = isValve
          ? (item['valve'] == true ? 1.0 : 0.0)
          : (item[field] ?? 0).toDouble();
      return FlSpot(time, val);
    }).toList();

    return LineChart(
      LineChartData(
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: !isValve,
            color: color,
            dotData: FlDotData(show: false),
            belowBarData:
                BarAreaData(show: true, color: color.withOpacity(0.1)),
          ),
        ],
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, _) {
                final dt = DateTime.fromMillisecondsSinceEpoch(value.toInt());
                return Text(DateFormat.Hm().format(dt),
                    style: const TextStyle(fontSize: 10));
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true),
          ),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: FlGridData(show: true),
        borderData: FlBorderData(show: true),
        minY: isValve ? 0 : null,
        maxY: isValve ? 1 : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isLoading = last1800.isEmpty || allData.isEmpty;

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('📈 Analytics'),
          bottom: TabBar(
            onTap: (index) {
              setState(() {
                activeTab = metricConfig.keys.elementAt(index);
              });
            },
            tabs: metricConfig.entries
                .map((e) => Tab(text: e.value['label']))
                .toList(),
          ),
        ),
        body: isLoading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text("Last 1800 Entries"),
                        ),
                        Expanded(child: buildChart(last1800)),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: Column(
                      children: [
                        const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text("All Data"),
                        ),
                        Expanded(child: buildChart(allData)),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
