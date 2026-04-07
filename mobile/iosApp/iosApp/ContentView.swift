import SwiftUI
import Shared

struct ContentView: View {
    var body: some View {
        VStack {
            Text(Greeting().greet())
                .font(.title)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
