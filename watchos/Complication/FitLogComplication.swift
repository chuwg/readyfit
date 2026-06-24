import WidgetKit
import SwiftUI

// MARK: - Shared keys (must match WatchSessionManager)

enum SharedKeys {
  static let appGroup = "group.com.fitlog.app.shared"
  static let score = "complication.score"
  static let status = "complication.status"
  static let advice = "complication.advice"
  static let updatedAt = "complication.updatedAt"
}

// MARK: - Entry

struct ReadinessEntry: TimelineEntry {
  let date: Date
  let score: Int?
  let status: String
  let advice: String
  let updatedAt: Date?

  static let placeholder = ReadinessEntry(
    date: Date(),
    score: 82,
    status: "양호",
    advice: "일반 훈련",
    updatedAt: Date()
  )

  static let empty = ReadinessEntry(
    date: Date(),
    score: nil,
    status: "—",
    advice: "iPhone 앱을 열어 동기화",
    updatedAt: nil
  )
}

// MARK: - Provider

struct ReadinessProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReadinessEntry {
    .placeholder
  }

  func getSnapshot(in context: Context, completion: @escaping (ReadinessEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ReadinessEntry>) -> Void) {
    let entry = currentEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func currentEntry() -> ReadinessEntry {
    guard let defaults = UserDefaults(suiteName: SharedKeys.appGroup) else {
      return .empty
    }
    let scoreObj = defaults.object(forKey: SharedKeys.score)
    let score = scoreObj as? Int
    let status = defaults.string(forKey: SharedKeys.status) ?? "—"
    let advice = defaults.string(forKey: SharedKeys.advice) ?? "—"
    let updatedAtMs = defaults.double(forKey: SharedKeys.updatedAt)
    let updatedAt = updatedAtMs > 0 ? Date(timeIntervalSince1970: updatedAtMs / 1000) : nil
    return ReadinessEntry(
      date: Date(),
      score: score,
      status: status,
      advice: advice,
      updatedAt: updatedAt
    )
  }
}

// MARK: - Helpers

func scoreColor(_ score: Int?) -> Color {
  guard let s = score else { return .secondary }
  if s >= 80 { return Color(red: 0/255, green: 212/255, blue: 170/255) }
  if s >= 60 { return Color(red: 245/255, green: 196/255, blue: 81/255) }
  if s >= 40 { return Color(red: 255/255, green: 159/255, blue: 67/255) }
  return Color(red: 255/255, green: 92/255, blue: 107/255)
}

// MARK: - Views

struct CircularView: View {
  let entry: ReadinessEntry
  var body: some View {
    ZStack {
      Circle().stroke(scoreColor(entry.score).opacity(0.25), lineWidth: 4)
      VStack(spacing: 0) {
        Text(entry.score.map(String.init) ?? "--")
          .font(.system(size: 22, weight: .heavy, design: .rounded))
          .foregroundStyle(scoreColor(entry.score))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
      }
    }
  }
}

struct CornerView: View {
  let entry: ReadinessEntry
  var body: some View {
    Text(entry.score.map(String.init) ?? "--")
      .font(.system(size: 14, weight: .bold, design: .rounded))
      .foregroundStyle(scoreColor(entry.score))
      .widgetLabel {
        Text(entry.status)
      }
  }
}

struct InlineView: View {
  let entry: ReadinessEntry
  var body: some View {
    Text("준비 \(entry.score.map(String.init) ?? "--")")
  }
}

struct RectangularView: View {
  let entry: ReadinessEntry
  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      Text(entry.score.map(String.init) ?? "--")
        .font(.system(size: 28, weight: .heavy, design: .rounded))
        .foregroundStyle(scoreColor(entry.score))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.status)
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(.primary)
        Text(entry.advice)
          .font(.system(size: 10))
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
      Spacer(minLength: 0)
    }
  }
}

// MARK: - Widget

struct FitLogComplicationEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: ReadinessEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      CircularView(entry: entry)
    case .accessoryCorner:
      CornerView(entry: entry)
    case .accessoryInline:
      InlineView(entry: entry)
    case .accessoryRectangular:
      RectangularView(entry: entry)
    default:
      RectangularView(entry: entry)
    }
  }
}

@main
struct FitLogComplication: Widget {
  let kind: String = "FitLogComplication"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ReadinessProvider()) { entry in
      FitLogComplicationEntryView(entry: entry)
    }
    .configurationDisplayName("레디핏")
    .description("훈련 준비 점수")
    .supportedFamilies([
      .accessoryCircular,
      .accessoryCorner,
      .accessoryInline,
      .accessoryRectangular,
    ])
  }
}
